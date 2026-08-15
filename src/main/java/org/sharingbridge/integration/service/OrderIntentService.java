package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.auth.Roles;
import org.sharingbridge.integration.geo.DonorNeighbourhoodArea;
import org.sharingbridge.integration.geo.DonorNeighbourhoodWindow;
import org.sharingbridge.integration.geo.NeighbourhoodFilter;
import org.sharingbridge.integration.geo.OrderIntentListMaxRows;
import org.sharingbridge.integration.geo.SinceFilter;
import org.sharingbridge.integration.repository.DonorEmailLookup;
import org.sharingbridge.integration.repository.OrderIntentStore;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class OrderIntentService {

    private final OrderIntentStore store;
    private final DonorEmailLookup emailLookup;
    private final PostalGeocodeService geocode;

    public OrderIntentService(
            @Autowired(required = false) OrderIntentStore store,
            @Autowired(required = false) DonorEmailLookup emailLookup,
            @Autowired(required = false) PostalGeocodeService geocode) {
        this.store = store;
        this.emailLookup = emailLookup;
        this.geocode = geocode;
    }

    public ResponseEntity<Map<String, Object>> create(String userId, Map<String, Object> payload) {
        requireStore();
        Map<String, Object> body = payload == null ? Map.of() : payload;
        String validationError = OrderIntents.validateCreateOrderIntentRequest(body);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        String packId = OrderIntents.resolvePackId(body);
        Map<String, Object> existingByPack =
                packId.isEmpty() ? null : store.findByPackId(userId, packId);
        String suppliedIntentId =
                body.get("order_intent_id") instanceof String text ? text.trim() : "";
        Map<String, Object> existingById =
                existingByPack == null && !suppliedIntentId.isEmpty()
                        ? store.findById(userId, suppliedIntentId)
                        : null;
        Map<String, Object> existing = existingByPack != null ? existingByPack : existingById;

        Map<String, Object> record;
        boolean created;
        if (existing != null) {
            record =
                    OrderIntentLocation.mergeLocationFromPayload(
                            OrderIntents.mergeOrderIntentRecord(existing, body), body, geocode);
            created = store.upsertForUser(userId, record).created();
        } else {
            record = OrderIntents.buildOrderIntentRecord(body, userId);
            OrderIntentLocation.Location location =
                    OrderIntentLocation.locationFromPayload(body, geocode);
            if (location != null) {
                record = OrderIntentLocation.applyLocationToRecord(record, location);
            }
            created = store.upsertForUser(userId, record).created();
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("order_intent_id", record.get("id"));
        response.put("user_id", userId);
        response.put("pack_id", record.get("pack_id"));
        response.put("status", record.get("status"));
        response.put("created_at", record.get("created_at"));
        response.put("updated_at", record.get("updated_at"));
        response.put("created", created);
        return ResponseEntity.status(created ? HttpStatus.CREATED : HttpStatus.OK).body(response);
    }

    public Map<String, Object> list(
            String userId,
            String role,
            String queryUserId,
            String since,
            String nearLat,
            String nearLng,
            String localityKey,
            String radiusM) {
        requireStore();
        String filter =
                queryUserId != null && !queryUserId.trim().isEmpty() ? queryUserId.trim() : null;
        NeighbourhoodFilter.Scope neighbourhoodScope =
                NeighbourhoodFilter.resolveNeighbourhoodScope(role, nearLat, nearLng, localityKey, radiusM);
        String neighbourhoodMode =
                NeighbourhoodFilter.type(neighbourhoodScope) == null
                        ? "own_only"
                        : NeighbourhoodFilter.type(neighbourhoodScope);
        Long sinceMs = SinceFilter.resolveListSinceMs(role, since, neighbourhoodMode);
        List<Map<String, Object>> records =
                store.listForDashboard(
                        new OrderIntentGeoSql.ListOpts(
                                filter,
                                sinceMs,
                                neighbourhoodScope,
                                userId,
                                role,
                                OrderIntentListMaxRows.getOrderIntentListMaxRows(),
                                Instant.now()));
        Map<String, String> donorEmailByUserId = Map.of();
        if (Roles.isCoordinatorApiRole(role) && emailLookup != null) {
            try {
                List<String> ids = new ArrayList<>();
                for (Map<String, Object> record : records) {
                    if (record.get("user_id") != null) {
                        ids.add(String.valueOf(record.get("user_id")));
                    }
                }
                donorEmailByUserId = emailLookup.lookupByUserId(ids);
            } catch (RuntimeException ignored) {
                donorEmailByUserId = Map.of();
            }
        }
        List<Map<String, Object>> orderIntents =
                OrderIntentViews.formatOrderIntentsForRole(
                        records, role, donorEmailByUserId, System.currentTimeMillis(), userId);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("user_id", userId);
        payload.put("role", role);
        payload.put("dashboard", Roles.isCoordinatorApiRole(role) ? "coordinator" : "limited");
        payload.put("order_intents", orderIntents);
        if (sinceMs != null) {
            payload.put("since", SinceFilter.formatSinceQuery(sinceMs));
        }
        String viewerLocalityKey = null;
        if (neighbourhoodScope instanceof NeighbourhoodFilter.NearScope near && geocode != null) {
            viewerLocalityKey = geocode.derivePostalLocalityKey(near.nearLat(), near.nearLng());
        }
        Map<String, Object> neighbourhood =
                NeighbourhoodFilter.formatNeighbourhoodResponse(neighbourhoodScope, viewerLocalityKey);
        if (neighbourhood != null) {
            payload.put("neighbourhood", neighbourhood);
        } else if (!Roles.isCoordinatorApiRole(role)) {
            payload.put("neighbourhood", Map.of("mode", "own_only"));
        }
        if (Roles.isCoordinatorApiRole(role)) {
            Map<String, Object> feed = new LinkedHashMap<>();
            feed.put(
                    "since",
                    sinceMs != null
                            ? payload.getOrDefault("since", SinceFilter.formatSinceQuery(sinceMs))
                            : null);
            feed.put("window_hours", sinceMs != null ? sinceMs / 3_600_000.0 : null);
            feed.put(
                    "radius_m",
                    neighbourhoodScope instanceof NeighbourhoodFilter.NearScope near
                            ? near.radiusM()
                            : null);
            String type = NeighbourhoodFilter.type(neighbourhoodScope);
            feed.put("location_mode", type == null ? "all" : type);
            feed.put(
                    "locality_key",
                    neighbourhoodScope instanceof NeighbourhoodFilter.LocalityScope loc
                            ? loc.localityKey()
                            : null);
            feed.put("max_rows", OrderIntentListMaxRows.getOrderIntentListMaxRows());
            payload.put("feed", feed);
        } else if (sinceMs != null) {
            Map<String, Object> feed = new LinkedHashMap<>();
            feed.put("since", payload.get("since"));
            feed.put("window_hours", DonorNeighbourhoodWindow.getDonorNeighbourhoodWindowHours());
            feed.put("radius_m", DonorNeighbourhoodArea.getDonorNeighbourhoodRadiusM());
            feed.put(
                    "location_mode",
                    NeighbourhoodFilter.type(neighbourhoodScope) == null
                            ? "own_only"
                            : NeighbourhoodFilter.type(neighbourhoodScope));
            payload.put("feed", feed);
        }
        return payload;
    }

    public Map<String, Object> patch(String userId, String role, String orderIntentId, Map<String, Object> payload) {
        requireStore();
        Map<String, Object> body = payload == null ? Map.of() : payload;
        String validationError = OrderIntentPatch.validatePatchOrderIntentRequest(body);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        boolean coordinator = Roles.isCoordinatorApiRole(role);
        Map<String, Object> existing;
        String ownerUserId = userId;
        if (coordinator) {
            existing = store.findByIdAny(orderIntentId);
            if (existing != null && existing.get("user_id") != null) {
                ownerUserId = String.valueOf(existing.get("user_id"));
            }
        } else {
            existing = store.findById(userId, orderIntentId);
        }
        if (existing == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "not_found", "Order intent not found.");
        }
        Map<String, Object> patched;
        try {
            patched = OrderIntentPatch.applyOrderIntentPatch(existing, body, role, Instant.now());
        } catch (OrderIntentPatch.ForbiddenPatchException ex) {
            throw new ApiException(HttpStatus.FORBIDDEN, "forbidden", ex.getMessage());
        }
        Map<String, Object> saved = store.updateRecordForUser(ownerUserId, patched);
        if (saved == null) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "update_failed", "Could not update order intent.");
        }
        return Map.of("order_intent", OrderIntents.formatOrderIntentForApi(saved));
    }

    private void requireStore() {
        if (store == null) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "Order intent store is not configured.");
        }
    }
}
