package org.sharingbridge.integration.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.sharingbridge.integration.geo.LocalityKey;
import org.sharingbridge.integration.geo.NeighbourhoodFilter;
import org.sharingbridge.integration.geo.SinceFilter;

public final class DemandBoard {

    private DemandBoard() {}

    public static List<Map<String, Object>> resolveActiveOfferBuckets(
            List<Map<String, Object>> seekerDemandRows) {
        List<Map<String, Object>> formatted = new ArrayList<>();
        for (Map<String, Object> row : seekerDemandRows) {
            formatted.add(SeekerDemands.formatSeekerDemandForApi(row));
        }
        return Marketplace.activeOfferBucketsFromSeekerDemands(formatted);
    }

    public static Map<String, Object> buildDemandBoardSnapshot(
            String role,
            List<Map<String, Object>> seekerDemandRows,
            List<Map<String, Object>> pledgeRows,
            List<Map<String, Object>> vendorBidRows,
            List<Map<String, Object>> standardOfferRows,
            boolean schemaReady,
            boolean marketplaceLive,
            Long sinceMs,
            NeighbourhoodFilter.Scope neighbourhoodScope) {
        List<Map<String, Object>> formatted = new ArrayList<>();
        for (Map<String, Object> row : seekerDemandRows == null ? List.<Map<String, Object>>of() : seekerDemandRows) {
            formatted.add(SeekerDemands.formatSeekerDemandForApi(row));
        }
        formatted = filterRowsBySince(formatted, sinceMs);
        formatted = filterRowsByNeighbourhood(formatted, neighbourhoodScope);

        List<Map<String, Object>> activeOfferBuckets =
                Marketplace.activeOfferBucketsFromSeekerDemands(formatted);

        List<Map<String, Object>> pledgesRaw = new ArrayList<>();
        for (Map<String, Object> row : pledgeRows == null ? List.<Map<String, Object>>of() : pledgeRows) {
            pledgesRaw.add(Marketplace.formatPledgeForApi(row));
        }
        List<Map<String, Object>> vendorBidsRaw = new ArrayList<>();
        for (Map<String, Object> row : vendorBidRows == null ? List.<Map<String, Object>>of() : vendorBidRows) {
            vendorBidsRaw.add(Marketplace.formatVendorBidForApi(row));
        }
        pledgesRaw = filterRowsBySince(pledgesRaw, sinceMs);
        vendorBidsRaw = filterRowsBySince(vendorBidsRaw, sinceMs);
        pledgesRaw = filterRowsByNeighbourhood(pledgesRaw, neighbourhoodScope);
        vendorBidsRaw = filterRowsByNeighbourhood(vendorBidsRaw, neighbourhoodScope);

        List<Map<String, Object>> pledges =
                Marketplace.tagMarketplaceOfferMatch(pledgesRaw, activeOfferBuckets);
        List<Map<String, Object>> vendorBids =
                Marketplace.tagMarketplaceOfferMatch(vendorBidsRaw, activeOfferBuckets);
        List<Map<String, Object>> windows =
                Marketplace.enrichDemandWindowsWithSupply(
                        SeekerDemands.aggregateDemandByStandardOffer(formatted),
                        pledgesRaw,
                        vendorBidsRaw);
        List<Map<String, Object>> orphanPledges = new ArrayList<>();
        for (Map<String, Object> row : pledges) {
            if (!Boolean.TRUE.equals(row.get("matches_demand_bucket"))) {
                orphanPledges.add(row);
            }
        }
        List<Map<String, Object>> orphanVendorBids = new ArrayList<>();
        for (Map<String, Object> row : vendorBids) {
            if (!Boolean.TRUE.equals(row.get("matches_demand_bucket"))) {
                orphanVendorBids.add(row);
            }
        }
        List<Map<String, Object>> standardOffers = new ArrayList<>();
        for (Map<String, Object> row :
                standardOfferRows == null ? List.<Map<String, Object>>of() : standardOfferRows) {
            standardOffers.add(StandardOffers.formatStandardOfferForApi(row));
        }
        LinkedHashSet<Object> localityKeys = new LinkedHashSet<>();
        for (Map<String, Object> bucket : activeOfferBuckets) {
            localityKeys.add(bucket.get("locality_key"));
        }

        String message;
        if (!schemaReady) {
            message = "Seeker demand storage is not configured.";
        } else if (marketplaceLive) {
            message =
                    "Seeker demands, pledges, and vendor bids are loaded from the database. Allocation hints are computed; auto-assign is not live yet.";
        } else {
            message =
                    "Seeker demands are available; marketplace pledge and vendor-bid tables are not configured.";
        }

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("status", schemaReady ? "live_seeker_demands" : "schema_pending");
        snapshot.put("role", role);
        snapshot.put("message", message);
        snapshot.put("standard_offers", standardOffers);
        snapshot.put("demand_windows", windows);
        snapshot.put("active_offer_buckets", activeOfferBuckets);
        snapshot.put("active_locality_keys", new ArrayList<>(localityKeys));
        snapshot.put("seeker_demands", formatted);
        snapshot.put("pledges", pledges);
        snapshot.put("vendor_bids", vendorBids);
        snapshot.put("orphan_pledges", orphanPledges);
        snapshot.put("orphan_vendor_bids", orphanVendorBids);
        snapshot.put("generated_at", java.time.Instant.now().toString());
        return snapshot;
    }

    static List<Map<String, Object>> filterRowsBySince(List<Map<String, Object>> rows, Long sinceMs) {
        if (sinceMs == null || sinceMs == 0) {
            return rows;
        }
        return SinceFilter.filterRecordsSince(rows, sinceMs, System.currentTimeMillis());
    }

    static boolean demandRowMatchesNeighbourhood(
            Map<String, Object> row, NeighbourhoodFilter.Scope scope) {
        if (scope == null) {
            return true;
        }
        if (scope instanceof NeighbourhoodFilter.LocalityScope locality) {
            return LocalityKey.recordMatchesLocalityFilter(row.get("locality_key"), locality.localityKey());
        }
        if (row.get("location_lat") != null && row.get("location_lng") != null) {
            Map<String, Object> record = new LinkedHashMap<>();
            record.put("locality_key", row.get("locality_key"));
            record.put("location_lat", row.get("location_lat"));
            record.put("location_lng", row.get("location_lng"));
            return NeighbourhoodFilter.intentMatchesNeighbourhood(record, scope);
        }
        return false;
    }

    static List<Map<String, Object>> filterRowsByNeighbourhood(
            List<Map<String, Object>> rows, NeighbourhoodFilter.Scope scope) {
        if (scope == null) {
            return rows;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            if (demandRowMatchesNeighbourhood(row, scope)) {
                out.add(row);
            }
        }
        return out;
    }
}
