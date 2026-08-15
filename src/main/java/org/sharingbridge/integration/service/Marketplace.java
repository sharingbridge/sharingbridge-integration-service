package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Marketplace {

    private Marketplace() {}

    public static String validateCreatePledgeRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        if (!JsValues.isNonEmptyString(payload.get("locality_key"))) {
            return "locality_key is required.";
        }
        if (!JsValues.isNonEmptyString(payload.get("standard_offer_id"))) {
            return "standard_offer_id is required.";
        }
        Integer units = JsValues.parseUnits(payload.get("meal_units") == null ? 1 : payload.get("meal_units"), 50);
        if (payload.get("meal_units") != null && units == null) {
            return "meal_units must be a positive integer up to 50.";
        }
        return EmailShareConsent.validateEmailShareConsent(payload);
    }

    public static String validateCreateVendorBidRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        if (!JsValues.isNonEmptyString(payload.get("locality_key"))) {
            return "locality_key is required.";
        }
        if (!JsValues.isNonEmptyString(payload.get("standard_offer_id"))) {
            return "standard_offer_id is required.";
        }
        if (!JsValues.isNonEmptyString(payload.get("vendor_name"))) {
            return "vendor_name is required.";
        }
        Integer portions = JsValues.parseUnits(payload.get("portions"), 500);
        if (portions == null) {
            return "portions must be a positive integer up to 500.";
        }
        return EmailShareConsent.validateEmailShareConsent(payload);
    }

    public static Map<String, Object> buildPledgeRecord(Map<String, Object> payload, String pledgedByUserId) {
        String now = Instant.now().toString();
        Integer units = JsValues.parseUnits(payload.get("meal_units") == null ? 1 : payload.get("meal_units"), 50);
        if (units == null) {
            units = 1;
        }
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", JsValues.randomPrefixedId("pl-"));
        record.put("pledged_by_user_id", pledgedByUserId);
        record.put(
                "demand_window_id",
                payload.get("demand_window_id") instanceof String text ? text.trim() : "");
        record.put("locality_key", String.valueOf(payload.get("locality_key")).trim());
        record.put("standard_offer_id", String.valueOf(payload.get("standard_offer_id")).trim());
        record.put(
                "menu_label",
                payload.get("menu_label") instanceof String text ? text.trim() : "");
        record.put("meal_units", units);
        record.put("status", "pledged");
        record.put("email_share_consent_at", EmailShareConsent.emailShareConsentTimestamp(payload));
        record.put("created_at", now);
        record.put("updated_at", now);
        return record;
    }

    public static Map<String, Object> buildVendorBidRecord(
            Map<String, Object> payload, String submittedByUserId) {
        String now = Instant.now().toString();
        Integer portions = JsValues.parseUnits(payload.get("portions"), 500);
        if (portions == null) {
            portions = 1;
        }
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", JsValues.randomPrefixedId("vb-"));
        record.put("submitted_by_user_id", submittedByUserId);
        record.put(
                "demand_window_id",
                payload.get("demand_window_id") instanceof String text ? text.trim() : "");
        record.put("locality_key", String.valueOf(payload.get("locality_key")).trim());
        record.put("standard_offer_id", String.valueOf(payload.get("standard_offer_id")).trim());
        record.put(
                "menu_label",
                payload.get("menu_label") instanceof String text ? text.trim() : "");
        record.put("vendor_name", String.valueOf(payload.get("vendor_name")).trim());
        record.put("portions", portions);
        record.put("notes", payload.get("notes") instanceof String text ? text.trim() : "");
        record.put("status", "submitted");
        record.put("commitment_status", "committed");
        record.put(
                "seeker_demand_id",
                payload.get("seeker_demand_id") instanceof String text ? text.trim() : null);
        record.put(
                "order_code",
                payload.get("order_code") instanceof String text ? text.trim() : null);
        record.put("email_share_consent_at", EmailShareConsent.emailShareConsentTimestamp(payload));
        record.put("created_at", now);
        record.put("updated_at", now);
        return record;
    }

    public static Map<String, Object> formatPledgeForApi(Map<String, Object> record) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pledge_id", record.get("id"));
        out.put("pledged_by_user_id", record.get("pledged_by_user_id"));
        Object window = record.get("demand_window_id");
        out.put(
                "demand_window_id",
                window instanceof String text && !text.isEmpty() ? text : (window == null || "".equals(window) ? null : window));
        if (window instanceof String text) {
            out.put("demand_window_id", text.isEmpty() ? null : text);
        }
        out.put("locality_key", record.get("locality_key"));
        out.put(
                "standard_offer_id",
                record.get("standard_offer_id") != null ? record.get("standard_offer_id") : null);
        out.put("menu_label", record.get("menu_label") != null ? record.get("menu_label") : "");
        out.put("meal_units", record.get("meal_units"));
        out.put("status", record.get("status"));
        out.put(
                "email_share_consent_at",
                record.get("email_share_consent_at") != null ? record.get("email_share_consent_at") : null);
        out.put("created_at", record.get("created_at"));
        out.put("updated_at", record.get("updated_at"));
        return out;
    }

    public static Map<String, Object> formatVendorBidForApi(Map<String, Object> record) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("vendor_bid_id", record.get("id"));
        out.put("submitted_by_user_id", record.get("submitted_by_user_id"));
        Object window = record.get("demand_window_id");
        out.put("demand_window_id", window instanceof String text && !text.isEmpty() ? text : null);
        out.put("locality_key", record.get("locality_key"));
        out.put(
                "standard_offer_id",
                record.get("standard_offer_id") != null ? record.get("standard_offer_id") : null);
        out.put("menu_label", record.get("menu_label") != null ? record.get("menu_label") : "");
        out.put("vendor_name", record.get("vendor_name"));
        out.put("portions", record.get("portions"));
        out.put("notes", record.get("notes") != null ? record.get("notes") : "");
        out.put("status", record.get("status"));
        out.put(
                "commitment_status",
                record.get("commitment_status") != null ? record.get("commitment_status") : "submitted");
        out.put(
                "seeker_demand_id",
                record.get("seeker_demand_id") != null ? record.get("seeker_demand_id") : null);
        out.put("order_code", record.get("order_code") != null ? record.get("order_code") : null);
        out.put(
                "email_share_consent_at",
                record.get("email_share_consent_at") != null ? record.get("email_share_consent_at") : null);
        out.put("created_at", record.get("created_at"));
        out.put("updated_at", record.get("updated_at"));
        return out;
    }

    public static List<Map<String, Object>> activeOfferBucketsFromSeekerDemands(
            List<Map<String, Object>> seekerDemandsFormatted) {
        List<Map<String, Object>> windows = SeekerDemands.aggregateDemandByStandardOffer(seekerDemandsFormatted);
        List<Map<String, Object>> buckets = new ArrayList<>();
        for (Map<String, Object> window : windows) {
            Map<String, Object> bucket = new LinkedHashMap<>();
            bucket.put("bucket_key", window.get("bucket_key"));
            bucket.put("locality_key", window.get("locality_key"));
            bucket.put("standard_offer_id", window.get("standard_offer_id"));
            bucket.put("menu_label", window.get("menu_label"));
            bucket.put("price_inr", window.get("price_inr"));
            buckets.add(bucket);
        }
        return buckets;
    }

    public static String validateMarketplaceOfferSelection(
            Object localityKey, Object standardOfferId, List<Map<String, Object>> activeBuckets) {
        String trimmedLocality = String.valueOf(localityKey == null ? "" : localityKey).trim();
        String trimmedOffer = String.valueOf(standardOfferId == null ? "" : standardOfferId).trim();
        if (trimmedLocality.isEmpty()) {
            return "locality_key is required.";
        }
        if (trimmedOffer.isEmpty()) {
            return "standard_offer_id is required.";
        }
        if (activeBuckets == null || activeBuckets.isEmpty()) {
            return "No demand lines yet. Record seeker demand with a standard menu item first.";
        }
        boolean match = false;
        for (Map<String, Object> bucket : activeBuckets) {
            if (trimmedLocality.equals(bucket.get("locality_key"))
                    && trimmedOffer.equals(bucket.get("standard_offer_id"))) {
                match = true;
                break;
            }
        }
        if (!match) {
            List<String> options = new ArrayList<>();
            for (Map<String, Object> bucket : activeBuckets) {
                if (bucket.get("standard_offer_id") != null) {
                    options.add(
                            bucket.get("menu_label")
                                    + " @ "
                                    + bucket.get("locality_key")
                                    + " ("
                                    + bucket.get("standard_offer_id")
                                    + ")");
                }
            }
            return "No matching demand line for that menu item. Active lines: "
                    + (options.isEmpty() ? "none with standard_offer_id" : String.join("; ", options));
        }
        return null;
    }

    public static List<Map<String, Object>> tagMarketplaceOfferMatch(
            List<Map<String, Object>> rows, List<Map<String, Object>> activeBuckets) {
        java.util.Set<Object> keys = new java.util.LinkedHashSet<>();
        for (Map<String, Object> bucket : activeBuckets) {
            keys.add(bucket.get("bucket_key"));
        }
        List<Map<String, Object>> tagged = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> next = JsValues.copy(row);
            next.put(
                    "matches_demand_bucket",
                    keys.contains(
                            StandardOffers.offerBucketKey(
                                    row.get("locality_key"),
                                    row.get("standard_offer_id") == null ? "legacy" : row.get("standard_offer_id"))));
            tagged.add(next);
        }
        return tagged;
    }

    public static List<Map<String, Object>> enrichDemandWindowsWithSupply(
            List<Map<String, Object>> demandWindows,
            List<Map<String, Object>> pledges,
            List<Map<String, Object>> vendorBids) {
        Map<String, Double> pledgedByKey = sumUnitsByOfferBucket(pledges, "meal_units");
        Map<String, Double> bidByKey = sumUnitsByOfferBucket(vendorBids, "portions");
        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Map<String, Object> window : demandWindows) {
            Object bucketKeyObj = window.get("bucket_key");
            String bucketKey =
                    bucketKeyObj != null
                            ? String.valueOf(bucketKeyObj)
                            : StandardOffers.offerBucketKey(
                                    window.get("locality_key"),
                                    window.get("standard_offer_id") == null
                                            ? "legacy"
                                            : window.get("standard_offer_id"));
            double pledged = pledgedByKey.getOrDefault(bucketKey, 0.0);
            double bidPortions = bidByKey.getOrDefault(bucketKey, 0.0);
            double demand = JsValues.jsNumber(window.get("meal_units_total"));
            if (!Double.isFinite(demand)) {
                demand = 0;
            }
            Map<String, Object> next = JsValues.copy(window);
            next.put("pledged_units_total", asJsNumber(pledged));
            next.put("bid_portions_total", asJsNumber(bidPortions));
            next.put("unmet_demand_units", asJsNumber(Math.max(0, demand - pledged)));
            next.put("supply_gap_units", asJsNumber(Math.max(0, demand - bidPortions)));
            next.put("allocation_hint", allocationHintForWindow(next));
            enriched.add(next);
        }
        return enriched;
    }

    private static Object asJsNumber(double value) {
        if (value == Math.rint(value) && Double.isFinite(value)) {
            return (long) value;
        }
        return value;
    }

    private static String allocationHintForWindow(Map<String, Object> window) {
        double unmet = JsValues.jsNumber(window.get("unmet_demand_units"));
        if (!Double.isFinite(unmet)) {
            unmet = 0;
        }
        double supplyGap = JsValues.jsNumber(window.get("supply_gap_units"));
        if (!Double.isFinite(supplyGap)) {
            supplyGap = 0;
        }
        if (unmet > 0) {
            return "needs_pledges";
        }
        if (supplyGap > 0) {
            return "needs_vendor_bids";
        }
        return "balanced";
    }

    private static Map<String, Double> sumUnitsByOfferBucket(List<Map<String, Object>> rows, String valueKey) {
        Map<String, Double> byKey = new LinkedHashMap<>();
        if (rows == null) {
            return byKey;
        }
        for (Map<String, Object> row : rows) {
            String key =
                    StandardOffers.offerBucketKey(
                            row.get("locality_key"),
                            row.get("standard_offer_id") == null ? "legacy" : row.get("standard_offer_id"));
            double amount = JsValues.jsNumber(row.get(valueKey));
            if (!Double.isFinite(amount)) {
                amount = 0;
            }
            byKey.merge(key, amount, Double::sum);
        }
        return byKey;
    }
}
