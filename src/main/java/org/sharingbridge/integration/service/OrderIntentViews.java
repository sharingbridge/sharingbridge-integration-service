package org.sharingbridge.integration.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.auth.Roles;
import org.sharingbridge.integration.geo.DonorNeighbourhoodWindow;

public final class OrderIntentViews {

    private OrderIntentViews() {}

    public static long intentTimestampMs(Map<String, Object> record) {
        Object raw = record.get("created_at");
        try {
            return java.time.Instant.parse(String.valueOf(raw == null ? "" : raw)).toEpochMilli();
        } catch (RuntimeException ex) {
            return 0;
        }
    }

    public static boolean referencePhotoWithinViewerWindow(Map<String, Object> record, long nowMs) {
        if (!Boolean.TRUE.equals(record.get("has_reference_photo"))) {
            return false;
        }
        long age = nowMs - intentTimestampMs(record);
        return age >= 0 && age <= DonorNeighbourhoodWindow.getDonorNeighbourhoodWindowMs();
    }

    private static boolean isOwnIntent(Map<String, Object> record, String viewerUserId) {
        Object ownerRaw = record == null ? null : record.get("user_id");
        String owner = ownerRaw instanceof String text ? text.trim() : "";
        String viewer = viewerUserId == null ? "" : viewerUserId.trim();
        return !owner.isEmpty() && !viewer.isEmpty() && owner.equals(viewer);
    }

    public static Map<String, Object> formatOrderIntentLimited(
            Map<String, Object> record, long nowMs, String viewerUserId) {
        Map<String, Object> base = OrderIntents.formatOrderIntentForApi(record);
        boolean keepCoords = isOwnIntent(record, viewerUserId);
        Map<String, Object> localized = new LinkedHashMap<>(base);
        localized.put("location_lat", keepCoords ? base.get("location_lat") : null);
        localized.put("location_lng", keepCoords ? base.get("location_lng") : null);
        if (isOwnIntent(record, viewerUserId)) {
            return localized;
        }
        if (!referencePhotoWithinViewerWindow(record, nowMs)) {
            Map<String, Object> redacted = new LinkedHashMap<>(localized);
            redacted.put("has_reference_photo", false);
            redacted.put("reference_photo_artifact_id", "");
            redacted.put("reference_photo_view_url", "");
            redacted.put("reference_photo_thumbnail_url", "");
            return redacted;
        }
        return localized;
    }

    public static Map<String, Object> formatOrderIntentCoordinator(
            Map<String, Object> record, Map<String, String> donorEmailByUserId, long nowMs) {
        Map<String, Object> base = OrderIntents.formatOrderIntentForApi(record);
        Object userObj = base.get("user_id");
        String userId = userObj instanceof String text ? text.trim() : "";
        String donorEmail = "";
        if (!userId.isEmpty() && donorEmailByUserId != null && donorEmailByUserId.get(userId) != null) {
            donorEmail = donorEmailByUserId.get(userId).trim();
        }
        String email = donorEmail.isEmpty() ? null : donorEmail;
        Map<String, Object> out = new LinkedHashMap<>(base);
        out.put("donor_email", email);
        out.put("initiator_email", email);
        return out;
    }

    public static Map<String, Object> formatOrderIntentForRole(
            Map<String, Object> record, String role, Map<String, String> donorEmailByUserId,
            long nowMs, String viewerUserId) {
        if (Roles.isCoordinatorApiRole(role)) {
            return formatOrderIntentCoordinator(
                    record, donorEmailByUserId == null ? Map.of() : donorEmailByUserId, nowMs);
        }
        return formatOrderIntentLimited(record, nowMs, viewerUserId == null ? "" : viewerUserId);
    }

    public static List<Map<String, Object>> formatOrderIntentsForRole(
            List<Map<String, Object>> records,
            String role,
            Map<String, String> donorEmailByUserId,
            long nowMs,
            String viewerUserId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> record : records) {
            out.add(formatOrderIntentForRole(record, role, donorEmailByUserId, nowMs, viewerUserId));
        }
        return out;
    }
}
