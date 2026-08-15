package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class OrderIntents {

    private OrderIntents() {}

    public static String validateCreateOrderIntentRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        if (!JsValues.isNonEmptyString(payload.get("pack_id"))) {
            return "pack_id is required.";
        }
        if (payload.get("status") != null
                && !"instructions_copied".equals(payload.get("status"))
                && !"created".equals(payload.get("status"))) {
            return "status must be instructions_copied or created.";
        }
        if (payload.get("presets_snapshot") != null && !(payload.get("presets_snapshot") instanceof List<?>)) {
            return "presets_snapshot must be an array when provided.";
        }
        return null;
    }

    public static String resolvePackId(Map<String, Object> payload) {
        return payload.get("pack_id") instanceof String text ? text.trim() : "";
    }

    public static Map<String, Object> buildOrderIntentRecord(Map<String, Object> payload, String userId) {
        String now = Instant.now().toString();
        String packId = resolvePackId(payload);
        if (packId.isEmpty()) {
            packId = "pack-unknown-" + System.currentTimeMillis();
        }
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", JsValues.randomPrefixedId("oi-"));
        record.put("order_code", OrderCode.generateOrderCode());
        record.put("initiation_route", InitiationRoutes.DIRECT_ORDER);
        record.put("user_id", userId);
        record.put("pack_id", packId);
        record.put("status", payload.get("status") != null ? payload.get("status") : "instructions_copied");
        record.put("has_reference_photo", Boolean.TRUE.equals(payload.get("has_reference_photo")));
        record.put(
                "reference_photo_artifact_id",
                payload.get("reference_photo_artifact_id") instanceof String text ? text.trim() : "");
        record.put(
                "reference_photo_view_url",
                payload.get("reference_photo_view_url") instanceof String text ? text.trim() : "");
        record.put(
                "reference_photo_thumbnail_url",
                payload.get("reference_photo_thumbnail_url") instanceof String text
                        ? text.trim()
                        : "");
        record.put(
                "verbal_handover_notes",
                payload.get("verbal_handover_notes") instanceof String text ? text.trim() : "");
        record.put(
                "presets_snapshot",
                payload.get("presets_snapshot") instanceof List<?> list ? list : List.of());
        Map<String, Object> selected = JsValues.asObjectMap(payload.get("selected_preset"));
        record.put("selected_preset", selected);
        record.put("location_lat", null);
        record.put("location_lng", null);
        record.put("location_label", "");
        record.put("locality_key", "");
        record.put("location_description", JsValues.optionalTrimmed(payload.get("location_description")));
        record.put("image_description", JsValues.optionalTrimmed(payload.get("image_description")));
        record.put(
                "seeker_appearance_hints",
                JsValues.optionalTrimmed(payload.get("seeker_appearance_hints")));
        record.put(
                "seeker_handover_hints",
                JsValues.optionalTrimmed(payload.get("seeker_handover_hints")));
        record.put("payment_status", "pending");
        record.put("delivery_status", "pending");
        record.put("delivery_photo_url", "");
        record.put("created_at", now);
        record.put("updated_at", now);
        return record;
    }

    public static Map<String, Object> formatOrderIntentForApi(Map<String, Object> record) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("order_intent_id", record.get("id"));
        out.put("order_code", record.get("order_code") != null ? record.get("order_code") : null);
        out.put(
                "initiation_route",
                record.get("initiation_route") != null
                        ? record.get("initiation_route")
                        : InitiationRoutes.DIRECT_ORDER);
        out.put("user_id", record.get("user_id") != null ? record.get("user_id") : null);
        out.put("pack_id", record.get("pack_id"));
        out.put("status", record.get("status"));
        out.put("has_reference_photo", Boolean.TRUE.equals(record.get("has_reference_photo"))
                || Boolean.TRUE.equals(toBoolean(record.get("has_reference_photo"))));
        out.put(
                "reference_photo_artifact_id",
                record.get("reference_photo_artifact_id") != null
                        ? record.get("reference_photo_artifact_id")
                        : "");
        out.put(
                "reference_photo_view_url",
                record.get("reference_photo_view_url") != null
                        ? record.get("reference_photo_view_url")
                        : "");
        out.put(
                "reference_photo_thumbnail_url",
                record.get("reference_photo_thumbnail_url") != null
                        ? record.get("reference_photo_thumbnail_url")
                        : "");
        out.put(
                "verbal_handover_notes",
                record.get("verbal_handover_notes") != null ? record.get("verbal_handover_notes") : "");
        out.put(
                "presets_snapshot",
                record.get("presets_snapshot") instanceof List<?> list ? list : List.of());
        Map<String, Object> selected = JsValues.asObjectMap(record.get("selected_preset"));
        out.put("selected_preset", selected);
        out.put(
                "location_lat",
                record.get("location_lat") instanceof Number n ? n.doubleValue() : null);
        out.put(
                "location_lng",
                record.get("location_lng") instanceof Number n ? n.doubleValue() : null);
        out.put(
                "location_label",
                record.get("location_label") instanceof String text ? text : "");
        out.put(
                "locality_key",
                record.get("locality_key") instanceof String text ? text : "");
        out.put("created_at", record.get("created_at"));
        out.put("updated_at", record.get("updated_at"));
        Object delivered = record.get("delivered_at");
        if (delivered instanceof String text && !text.trim().isEmpty()) {
            out.put("delivered_at", text.trim());
        } else {
            out.put("delivered_at", null);
        }
        if (record.get("distance_m") instanceof Number n && Double.isFinite(n.doubleValue())) {
            out.put("distance_m", (int) Math.round(n.doubleValue()));
        } else {
            out.put("distance_m", null);
        }
        out.put(
                "location_description",
                record.get("location_description") != null ? record.get("location_description") : "");
        out.put(
                "image_description",
                record.get("image_description") != null ? record.get("image_description") : "");
        out.put(
                "seeker_appearance_hints",
                record.get("seeker_appearance_hints") != null
                        ? record.get("seeker_appearance_hints")
                        : "");
        out.put(
                "seeker_handover_hints",
                record.get("seeker_handover_hints") != null
                        ? record.get("seeker_handover_hints")
                        : "");
        Object payment = record.get("payment_status");
        out.put(
                "payment_status",
                payment instanceof String text && !text.trim().isEmpty() ? text.trim() : "pending");
        Object delivery = record.get("delivery_status");
        out.put(
                "delivery_status",
                delivery instanceof String text && !text.trim().isEmpty() ? text.trim() : "pending");
        out.put(
                "delivery_photo_url",
                record.get("delivery_photo_url") instanceof String text ? text.trim() : "");
        return out;
    }

    public static Map<String, Object> mergeOrderIntentRecord(
            Map<String, Object> existing, Map<String, Object> payload) {
        String now = Instant.now().toString();
        Map<String, Object> next = JsValues.copy(existing);
        next.put(
                "status",
                payload.get("status") != null
                        ? payload.get("status")
                        : (existing.get("status") != null ? existing.get("status") : "instructions_copied"));
        if (payload.get("has_reference_photo") != null) {
            next.put("has_reference_photo", Boolean.TRUE.equals(payload.get("has_reference_photo"))
                    || Boolean.TRUE.equals(toBoolean(payload.get("has_reference_photo"))));
        } else {
            next.put("has_reference_photo", existing.get("has_reference_photo"));
        }
        if (Boolean.FALSE.equals(payload.get("has_reference_photo"))
                || Boolean.FALSE.equals(toBoolean(payload.get("has_reference_photo")))) {
            next.put("reference_photo_artifact_id", "");
            next.put("reference_photo_view_url", "");
            next.put("reference_photo_thumbnail_url", "");
        } else {
            if (payload.get("reference_photo_artifact_id") instanceof String text) {
                next.put("reference_photo_artifact_id", text.trim());
            } else {
                next.put("reference_photo_artifact_id", existing.get("reference_photo_artifact_id"));
            }
            if (payload.get("reference_photo_view_url") instanceof String text) {
                next.put("reference_photo_view_url", text.trim());
            } else {
                next.put("reference_photo_view_url", existing.get("reference_photo_view_url"));
            }
            if (payload.get("reference_photo_thumbnail_url") instanceof String text) {
                next.put("reference_photo_thumbnail_url", text.trim());
            } else {
                next.put("reference_photo_thumbnail_url", existing.get("reference_photo_thumbnail_url"));
            }
        }
        if (payload.get("verbal_handover_notes") instanceof String text) {
            next.put("verbal_handover_notes", text.trim());
        } else {
            next.put("verbal_handover_notes", existing.get("verbal_handover_notes"));
        }
        next.put(
                "presets_snapshot",
                payload.get("presets_snapshot") instanceof List<?> list
                        ? list
                        : existing.get("presets_snapshot"));
        Map<String, Object> selected = JsValues.asObjectMap(payload.get("selected_preset"));
        next.put("selected_preset", selected != null ? selected : existing.get("selected_preset"));
        next.put("location_lat", existing.get("location_lat") != null ? existing.get("location_lat") : null);
        next.put("location_lng", existing.get("location_lng") != null ? existing.get("location_lng") : null);
        next.put("location_label", existing.get("location_label") != null ? existing.get("location_label") : "");
        next.put("locality_key", existing.get("locality_key") != null ? existing.get("locality_key") : "");
        String locDesc = JsValues.optionalTrimmed(payload.get("location_description"));
        next.put(
                "location_description",
                !locDesc.isEmpty()
                        ? locDesc
                        : (existing.get("location_description") != null
                                ? existing.get("location_description")
                                : ""));
        String imgDesc = JsValues.optionalTrimmed(payload.get("image_description"));
        next.put(
                "image_description",
                !imgDesc.isEmpty()
                        ? imgDesc
                        : (existing.get("image_description") != null
                                ? existing.get("image_description")
                                : ""));
        String appearance = JsValues.optionalTrimmed(payload.get("seeker_appearance_hints"));
        next.put(
                "seeker_appearance_hints",
                !appearance.isEmpty()
                        ? appearance
                        : (existing.get("seeker_appearance_hints") != null
                                ? existing.get("seeker_appearance_hints")
                                : ""));
        String handover = JsValues.optionalTrimmed(payload.get("seeker_handover_hints"));
        next.put(
                "seeker_handover_hints",
                !handover.isEmpty()
                        ? handover
                        : (existing.get("seeker_handover_hints") != null
                                ? existing.get("seeker_handover_hints")
                                : ""));
        next.put(
                "payment_status",
                existing.get("payment_status") != null ? existing.get("payment_status") : "pending");
        next.put(
                "delivery_status",
                existing.get("delivery_status") != null ? existing.get("delivery_status") : "pending");
        next.put(
                "delivery_photo_url",
                existing.get("delivery_photo_url") != null ? existing.get("delivery_photo_url") : "");
        next.put(
                "delivered_at",
                existing.get("delivered_at") != null ? existing.get("delivered_at") : null);
        next.put("updated_at", now);
        return next;
    }

    private static Boolean toBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        return null;
    }
}
