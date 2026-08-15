package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.auth.Roles;
import org.sharingbridge.integration.geo.LocalityKey;
import org.sharingbridge.integration.repository.MarketplaceStore;
import org.sharingbridge.integration.repository.SeekerDemandStore;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SeekerDemandService {

    private final SeekerDemandStore seekerDemandStore;
    private final MarketplaceStore marketplaceStore;
    private final PostalGeocodeService geocode;

    public SeekerDemandService(
            @Autowired(required = false) SeekerDemandStore seekerDemandStore,
            @Autowired(required = false) MarketplaceStore marketplaceStore,
            @Autowired(required = false) PostalGeocodeService geocode) {
        this.seekerDemandStore = seekerDemandStore;
        this.marketplaceStore = marketplaceStore;
        this.geocode = geocode;
    }

    public Map<String, Object> list(String userId, String role) {
        if (seekerDemandStore == null) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "seeker_demand_unavailable",
                    "Seeker demand store is not configured.");
        }
        String reporterFilter = Roles.isCoordinatorApiRole(role) ? null : userId;
        List<Map<String, Object>> rows = seekerDemandStore.listRecent(100, reporterFilter);
        List<Map<String, Object>> formatted = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            formatted.add(SeekerDemands.formatSeekerDemandForApi(row));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("user_id", userId);
        body.put("role", role);
        body.put("seeker_demands", formatted);
        return body;
    }

    public Map<String, Object> create(String userId, Map<String, Object> payload) {
        Map<String, Object> body = payload == null ? Map.of() : payload;
        String validationError = SeekerDemands.validateCreateSeekerDemandRequest(body);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        if (seekerDemandStore == null) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "seeker_demand_unavailable",
                    "Seeker demand store is not configured.");
        }
        if (marketplaceStore == null) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "marketplace_unavailable",
                    "Standard offers catalog is not configured.");
        }
        Map<String, Object> standardOffer =
                marketplaceStore.getStandardOfferById(String.valueOf(body.get("standard_offer_id")));
        if (standardOffer == null) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "invalid_standard_offer_id",
                    "standard_offer_id not found. Choose a menu item for this area.");
        }
        Map<String, Object> record =
                SeekerDemands.buildSeekerDemandRecord(body, userId, standardOffer);
        record =
                OrderIntentLocation.applyLocationToRecord(
                        record, OrderIntentLocation.locationFromPayload(body, geocode));
        if (record.get("locality_key") == null
                || String.valueOf(record.get("locality_key")).isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "location_required",
                    "location_lat and location_lng are required to resolve postal area (IN:TN:PIN).");
        }
        if (!LocalityKey.offerAppliesToLocality(
                standardOffer.get("locality_key"), record.get("locality_key"))) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "offer_locality_mismatch",
                    "This menu item is for "
                            + standardOffer.get("locality_key")
                            + " but GPS resolves to "
                            + record.get("locality_key")
                            + ". Pick an item for your postal area.");
        }
        Map<String, Object> saved = seekerDemandStore.insertForReporter(userId, record);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("user_id", userId);
        response.put("created", true);
        response.put("seeker_demand", SeekerDemands.formatSeekerDemandForApi(saved));
        return response;
    }

    public Map<String, Object> patch(String seekerDemandId, Map<String, Object> payload) {
        if (seekerDemandStore == null) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "seeker_demand_unavailable",
                    "Seeker demand storage is not configured.");
        }
        Map<String, Object> existing = seekerDemandStore.findById(seekerDemandId);
        if (existing == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "not_found", "Seeker demand not found.");
        }
        Map<String, Object> patched =
                SeekerDemandPatch.applySeekerDemandPatch(
                        existing, payload == null ? Map.of() : payload, true, Instant.now());
        Map<String, Object> saved = seekerDemandStore.updateByCoordinator(seekerDemandId, patched);
        if (saved == null) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "update_failed", "Could not update seeker demand.");
        }
        return Map.of("seeker_demand", SeekerDemands.formatSeekerDemandForApi(saved));
    }
}
