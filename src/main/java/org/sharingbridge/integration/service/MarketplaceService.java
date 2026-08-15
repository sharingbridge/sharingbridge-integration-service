package org.sharingbridge.integration.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.sharingbridge.integration.auth.Roles;
import org.sharingbridge.integration.geo.NeighbourhoodFilter;
import org.sharingbridge.integration.geo.OrderIntentListMaxRows;
import org.sharingbridge.integration.geo.SinceFilter;
import org.sharingbridge.integration.repository.DonorEmailLookup;
import org.sharingbridge.integration.repository.MarketplaceStore;
import org.sharingbridge.integration.repository.SeekerDemandStore;
import org.sharingbridge.integration.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class MarketplaceService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceService.class);

    private final MarketplaceStore marketplaceStore;
    private final SeekerDemandStore seekerDemandStore;
    private final PostalGeocodeService geocode;
    private final ConnectionNotifier connectionNotifier;
    private final DonorEmailLookup emailLookup;

    public MarketplaceService(
            @Autowired(required = false) MarketplaceStore marketplaceStore,
            @Autowired(required = false) SeekerDemandStore seekerDemandStore,
            @Autowired(required = false) PostalGeocodeService geocode,
            @Autowired(required = false) ConnectionNotifier connectionNotifier,
            @Autowired(required = false) DonorEmailLookup emailLookup) {
        this.marketplaceStore = marketplaceStore;
        this.seekerDemandStore = seekerDemandStore;
        this.geocode = geocode;
        this.connectionNotifier = connectionNotifier;
        this.emailLookup = emailLookup;
    }

    public Map<String, Object> listStandardOffers(String userId, String localityKey, String lat, String lng) {
        if (marketplaceStore == null) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "marketplace_unavailable",
                    "Marketplace store is not configured.");
        }
        String resolved = localityKey == null ? "" : localityKey.trim();
        if (resolved.isEmpty() && lat != null && lng != null && geocode != null) {
            try {
                double latN = Double.parseDouble(lat);
                double lngN = Double.parseDouble(lng);
                if (Double.isFinite(latN) && Double.isFinite(lngN)) {
                    String derived = geocode.derivePostalLocalityKey(latN, lngN);
                    resolved = derived == null ? "" : derived;
                }
            } catch (NumberFormatException ignored) {
                // keep empty
            }
        }
        List<Map<String, Object>> catalog = marketplaceStore.listStandardOffers(null);
        List<Map<String, Object>> rows =
                resolved.isEmpty()
                        ? catalog
                        : org.sharingbridge.integration.geo.LocalityKey.resolveStandardOffersForLocality(
                                catalog, resolved);
        List<Map<String, Object>> formatted = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            formatted.add(StandardOffers.formatStandardOfferForApi(row));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("user_id", userId);
        body.put("locality_key", resolved.isEmpty() ? null : resolved);
        body.put("standard_offers", formatted);
        return body;
    }

    public Map<String, Object> demandBoard(
            String role, String since, String nearLat, String nearLng, String localityKey, String radiusM) {
        Long sinceMs = SinceFilter.resolveListSinceMs(role, since, null);
        NeighbourhoodFilter.Scope neighbourhoodScope =
                Roles.isCoordinatorApiRole(role)
                        ? NeighbourhoodFilter.resolveNeighbourhoodScope(
                                role, nearLat, nearLng, localityKey, radiusM)
                        : null;
        String viewerLocalityKey = null;
        if (neighbourhoodScope instanceof NeighbourhoodFilter.NearScope near && geocode != null) {
            viewerLocalityKey = geocode.derivePostalLocalityKey(near.nearLat(), near.nearLng());
        }
        List<Map<String, Object>> seekerRows =
                seekerDemandStore == null ? List.of() : seekerDemandStore.listRecent(100, null);
        List<Map<String, Object>> pledges =
                marketplaceStore == null ? List.of() : marketplaceStore.listPledges(100);
        List<Map<String, Object>> bids =
                marketplaceStore == null ? List.of() : marketplaceStore.listVendorBids(100);
        List<Map<String, Object>> offers =
                marketplaceStore == null ? List.of() : marketplaceStore.listStandardOffers(null);
        boolean schemaReady = seekerDemandStore == null || seekerDemandStore.isEnabled();
        boolean marketplaceLive = marketplaceStore == null || marketplaceStore.isEnabled();
        Map<String, Object> snapshot =
                DemandBoard.buildDemandBoardSnapshot(
                        role,
                        seekerRows,
                        pledges,
                        bids,
                        offers,
                        schemaReady,
                        marketplaceLive,
                        Roles.isCoordinatorApiRole(role) ? sinceMs : null,
                        neighbourhoodScope);
        if (sinceMs != null) {
            snapshot.put("since", SinceFilter.formatSinceQuery(sinceMs));
        }
        snapshot.put(
                "neighbourhood",
                NeighbourhoodFilter.formatNeighbourhoodResponse(neighbourhoodScope, viewerLocalityKey));
        Map<String, Object> feed = new LinkedHashMap<>();
        feed.put("since", sinceMs != null ? SinceFilter.formatSinceQuery(sinceMs) : null);
        feed.put("window_hours", sinceMs != null ? sinceMs / 3_600_000.0 : null);
        feed.put(
                "radius_m",
                neighbourhoodScope instanceof NeighbourhoodFilter.NearScope near ? near.radiusM() : null);
        String type = NeighbourhoodFilter.type(neighbourhoodScope);
        feed.put(
                "location_mode",
                "locality".equals(type) ? "locality" : "near".equals(type) ? "near" : "all");
        feed.put(
                "locality_key",
                neighbourhoodScope instanceof NeighbourhoodFilter.LocalityScope loc
                        ? loc.localityKey()
                        : null);
        feed.put("max_rows", OrderIntentListMaxRows.getOrderIntentListMaxRows());
        snapshot.put("feed", feed);
        return snapshot;
    }

    public Map<String, Object> createPledge(String userId, Map<String, Object> payload) {
        if (marketplaceStore == null) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "marketplace_unavailable",
                    "Marketplace store is not configured.");
        }
        Map<String, Object> body = payload == null ? Map.of() : payload;
        String validationError = Marketplace.validateCreatePledgeRequest(body);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        List<Map<String, Object>> activeBuckets = resolveActiveOfferBuckets();
        String offerError =
                Marketplace.validateMarketplaceOfferSelection(
                        body.get("locality_key"), body.get("standard_offer_id"), activeBuckets);
        if (offerError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_offer_selection", offerError);
        }
        Map<String, Object> offer =
                marketplaceStore.getStandardOfferById(String.valueOf(body.get("standard_offer_id")));
        Map<String, Object> withLabel = new LinkedHashMap<>(body);
        if (offer != null && offer.get("menu_label") != null) {
            withLabel.put("menu_label", offer.get("menu_label"));
        }
        Map<String, Object> record = Marketplace.buildPledgeRecord(withLabel, userId);
        Map<String, Object> saved = marketplaceStore.insertPledge(record);
        return Map.of("pledge", Marketplace.formatPledgeForApi(saved));
    }

    public Map<String, Object> createVendorBid(String userId, Map<String, Object> payload) {
        if (marketplaceStore == null) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "marketplace_unavailable",
                    "Marketplace store is not configured.");
        }
        Map<String, Object> body = payload == null ? Map.of() : payload;
        String validationError = Marketplace.validateCreateVendorBidRequest(body);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        List<Map<String, Object>> activeBuckets = resolveActiveOfferBuckets();
        String offerError =
                Marketplace.validateMarketplaceOfferSelection(
                        body.get("locality_key"), body.get("standard_offer_id"), activeBuckets);
        if (offerError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_offer_selection", offerError);
        }
        Map<String, Object> offer =
                marketplaceStore.getStandardOfferById(String.valueOf(body.get("standard_offer_id")));
        Map<String, Object> withLabel = new LinkedHashMap<>(body);
        if (offer != null && offer.get("menu_label") != null) {
            withLabel.put("menu_label", offer.get("menu_label"));
        }
        Map<String, Object> record = Marketplace.buildVendorBidRecord(withLabel, userId);
        List<Map<String, Object>> recent =
                seekerDemandStore == null ? List.of() : seekerDemandStore.listRecent(100, null);
        Map<String, Object> linked = SeekerDemandLink.enrichVendorBidWithSeekerDemand(record, recent);
        Map<String, Object> saved = marketplaceStore.insertVendorBid(linked);
        if ("committed".equals(saved.get("commitment_status"))
                && saved.get("order_code") != null
                && seekerDemandStore != null) {
            Map<String, Object> seekerDemand =
                    seekerDemandStore.findByOrderCode(String.valueOf(saved.get("order_code")));
            List<Map<String, Object>> pledges = List.of();
            if (seekerDemand != null) {
                List<Map<String, Object>> all = marketplaceStore.listPledges(200);
                pledges = new ArrayList<>();
                for (Map<String, Object> row : all) {
                    if (String.valueOf(row.get("locality_key")).equals(String.valueOf(seekerDemand.get("locality_key")))
                            && String.valueOf(row.get("standard_offer_id"))
                                    .equals(String.valueOf(seekerDemand.get("standard_offer_id")))) {
                        pledges.add(row);
                    }
                }
            }
            List<String> recipientUserIds =
                    SeekerDemandLink.connectionNotifyRecipientIds(seekerDemand, saved, pledges);
            if (connectionNotifier != null) {
                CompletableFuture.runAsync(
                        () -> {
                            try {
                                connectionNotifier.notifyConnectionReady(
                                        String.valueOf(saved.get("order_code")),
                                        recipientUserIds,
                                        ids ->
                                                emailLookup == null
                                                        ? Map.of()
                                                        : emailLookup.lookupByUserId(ids));
                            } catch (RuntimeException ex) {
                                log.warn("connection notify failed: {}", ex.getMessage());
                            }
                        });
            }
        }
        return Map.of("vendor_bid", Marketplace.formatVendorBidForApi(saved));
    }

    private List<Map<String, Object>> resolveActiveOfferBuckets() {
        if (seekerDemandStore == null || !seekerDemandStore.isEnabled()) {
            return List.of();
        }
        return DemandBoard.resolveActiveOfferBuckets(seekerDemandStore.listRecent(100, null));
    }
}
