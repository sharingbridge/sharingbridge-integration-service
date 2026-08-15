package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class SeekerDemands {

    private SeekerDemands() {}

    public static String validateCreateSeekerDemandRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        if (!JsValues.isNonEmptyString(payload.get("standard_offer_id"))) {
            return "standard_offer_id is required. Choose a standard menu item for this area.";
        }
        Integer units = JsValues.parseMealUnits(payload.get("meal_units"));
        if (payload.get("meal_units") != null && units == null) {
            return "meal_units must be a positive integer up to 50.";
        }
        return EmailShareConsent.validateEmailShareConsent(payload);
    }

    public static Map<String, Object> buildSeekerDemandRecord(
            Map<String, Object> payload, String reportedByUserId, Map<String, Object> standardOffer) {
        String now = Instant.now().toString();
        Integer mealUnits = JsValues.parseMealUnits(payload.get("meal_units"));
        if (mealUnits == null) {
            mealUnits = 1;
        }
        String verbalNotes =
                payload.get("verbal_notes") instanceof String text ? text.trim() : "";
        String menuLabel = String.valueOf(standardOffer == null ? "" : standardOffer.getOrDefault("menu_label", "")).trim();
        Object offerId = standardOffer == null ? null : standardOffer.get("id");
        Object price = standardOffer == null ? null : standardOffer.get("price_inr");

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", JsValues.randomPrefixedId("sd-"));
        record.put("order_code", OrderCode.generateOrderCode());
        record.put("initiation_route", InitiationRoutes.resolveSeekerDemandRoute(payload));
        record.put("initiator_email_share_consent_at", EmailShareConsent.emailShareConsentTimestamp(payload));
        record.put("reported_by_user_id", reportedByUserId);
        record.put("status", "recorded");
        record.put("meal_units", mealUnits);
        record.put("standard_offer_id", offerId);
        record.put("menu_label", menuLabel);
        record.put("price_inr", price == null ? null : JsValues.jsNumber(price));
        record.put("need_description", menuLabel);
        record.put("verbal_notes", verbalNotes);
        record.put("location_lat", null);
        record.put("location_lng", null);
        record.put("location_label", "");
        record.put("locality_key", "");
        record.put("created_at", now);
        record.put("updated_at", now);
        return record;
    }

    public static Map<String, Object> formatSeekerDemandForApi(Map<String, Object> record) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("seeker_demand_id", record.get("id"));
        out.put("order_code", record.get("order_code") != null ? record.get("order_code") : null);
        out.put(
                "initiation_route",
                record.get("initiation_route") != null
                        ? record.get("initiation_route")
                        : InitiationRoutes.ECO_KITCHEN_PLEDGE);
        out.put(
                "reported_by_user_id",
                record.get("reported_by_user_id") != null ? record.get("reported_by_user_id") : null);
        out.put("status", record.get("status"));
        out.put("meal_units", record.get("meal_units"));
        out.put("standard_offer_id", record.get("standard_offer_id") != null ? record.get("standard_offer_id") : null);
        Object menu = record.get("menu_label");
        if (menu == null) {
            menu = record.get("need_description");
        }
        out.put("menu_label", menu != null ? menu : "");
        out.put(
                "price_inr",
                record.get("price_inr") instanceof Number n ? n.doubleValue() : null);
        out.put("need_description", record.get("need_description"));
        out.put("verbal_notes", record.get("verbal_notes") != null ? record.get("verbal_notes") : "");
        out.put(
                "location_lat",
                record.get("location_lat") instanceof Number n ? n.doubleValue() : null);
        out.put(
                "location_lng",
                record.get("location_lng") instanceof Number n ? n.doubleValue() : null);
        out.put("location_label", record.get("location_label") != null ? record.get("location_label") : "");
        out.put("locality_key", record.get("locality_key") != null ? record.get("locality_key") : "");
        out.put("created_at", record.get("created_at"));
        out.put("updated_at", record.get("updated_at"));
        Object delivered = record.get("delivered_at");
        if (delivered instanceof String text && !text.trim().isEmpty()) {
            out.put("delivered_at", text.trim());
        } else {
            out.put("delivered_at", null);
        }
        return out;
    }

    public static List<Map<String, Object>> aggregateDemandByLocality(List<Map<String, Object>> seekerDemands) {
        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (Map<String, Object> row : seekerDemands) {
            Object keyObj = row.get("locality_key");
            String key = keyObj != null && !String.valueOf(keyObj).trim().isEmpty()
                    ? String.valueOf(keyObj).trim()
                    : "unknown";
            Map<String, Object> entry = byKey.get(key);
            if (entry == null) {
                entry = new LinkedHashMap<>();
                entry.put("locality_key", key);
                entry.put("demand_count", 0);
                entry.put("meal_units_total", 0);
                entry.put("latest_at", row.get("updated_at"));
                byKey.put(key, entry);
            }
            entry.put("demand_count", ((Number) entry.get("demand_count")).intValue() + 1);
            double units = JsValues.jsNumber(row.get("meal_units"));
            if (!Double.isFinite(units)) {
                units = 1;
            }
            entry.put("meal_units_total", ((Number) entry.get("meal_units_total")).doubleValue() + units);
            if (String.valueOf(row.get("updated_at")).compareTo(String.valueOf(entry.get("latest_at"))) > 0) {
                entry.put("latest_at", row.get("updated_at"));
            }
        }
        List<Map<String, Object>> rows = new ArrayList<>(byKey.values());
        rows.sort(Comparator.comparingDouble(
                a -> -((Number) a.get("meal_units_total")).doubleValue()));
        return rows;
    }

    public static List<Map<String, Object>> aggregateDemandByStandardOffer(
            List<Map<String, Object>> seekerDemands) {
        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (Map<String, Object> row : seekerDemands) {
            Object locObj = row.get("locality_key");
            String locality =
                    locObj != null && !String.valueOf(locObj).trim().isEmpty()
                            ? String.valueOf(locObj).trim()
                            : "unknown";
            Object offerObj = row.get("standard_offer_id");
            String offerId =
                    offerObj != null && !String.valueOf(offerObj).trim().isEmpty()
                            ? String.valueOf(offerObj).trim()
                            : "legacy";
            String bucket = StandardOffers.offerBucketKey(locality, offerId);
            Map<String, Object> entry = byKey.get(bucket);
            if (entry == null) {
                Object menu = row.get("menu_label");
                if (menu == null) {
                    menu = row.get("need_description");
                }
                if (menu == null) {
                    menu = "legacy".equals(offerId) ? "Legacy free-text demand" : "Standard item";
                }
                entry = new LinkedHashMap<>();
                entry.put("bucket_key", bucket);
                entry.put("locality_key", locality);
                entry.put("standard_offer_id", "legacy".equals(offerId) ? null : offerId);
                entry.put("menu_label", menu);
                entry.put(
                        "price_inr",
                        row.get("price_inr") instanceof Number n ? n.doubleValue() : null);
                entry.put("demand_count", 0);
                entry.put("meal_units_total", 0);
                entry.put("latest_at", row.get("updated_at"));
                byKey.put(bucket, entry);
            }
            entry.put("demand_count", ((Number) entry.get("demand_count")).intValue() + 1);
            double units = JsValues.jsNumber(row.get("meal_units"));
            if (!Double.isFinite(units)) {
                units = 1;
            }
            entry.put("meal_units_total", ((Number) entry.get("meal_units_total")).doubleValue() + units);
            if (String.valueOf(row.get("updated_at")).compareTo(String.valueOf(entry.get("latest_at"))) > 0) {
                entry.put("latest_at", row.get("updated_at"));
            }
        }
        List<Map<String, Object>> rows = new ArrayList<>(byKey.values());
        rows.sort((a, b) -> {
            String la = String.valueOf(a.get("locality_key"));
            String lb = String.valueOf(b.get("locality_key"));
            int cmp = la.compareTo(lb);
            if (cmp != 0) {
                return cmp;
            }
            return Double.compare(
                    ((Number) b.get("meal_units_total")).doubleValue(),
                    ((Number) a.get("meal_units_total")).doubleValue());
        });
        return rows;
    }
}
