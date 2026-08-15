package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.geo.DonorNeighbourhoodWindow;

class OrderIntentViewsTest {

    private static final long NOW = Instant.parse("2026-06-02T12:00:00.000Z").toEpochMilli();

    private static Map<String, Object> recordWithPhoto(long ageMs, String userId) {
        Map<String, Object> record = new HashMap<>();
        record.put("id", "oi-1");
        record.put("user_id", userId);
        record.put("pack_id", "pack-1");
        record.put("status", "instructions_copied");
        record.put("created_at", Instant.ofEpochMilli(NOW - ageMs).toString());
        record.put("updated_at", Instant.ofEpochMilli(NOW - ageMs).toString());
        record.put("has_reference_photo", true);
        record.put("reference_photo_artifact_id", "art-1");
        record.put("reference_photo_view_url", "https://cdn/view");
        record.put("reference_photo_thumbnail_url", "https://cdn/thumb");
        record.put("presets_snapshot", List.of());
        return record;
    }

    @Test
    void formatOrderIntentLimitedStripsPhotoUrlsOutsideWindow() {
        long windowMs = DonorNeighbourhoodWindow.getDonorNeighbourhoodWindowMs();
        Map<String, Object> formatted =
                OrderIntentViews.formatOrderIntentLimited(recordWithPhoto(windowMs + 1000, "alice"), NOW, "bob");
        assertEquals(false, formatted.get("has_reference_photo"));
        assertEquals("", formatted.get("reference_photo_view_url"));
        assertEquals("", formatted.get("reference_photo_thumbnail_url"));
    }

    @Test
    void formatOrderIntentLimitedKeepsOwnPhotoUrlsForHistoryList() {
        long windowMs = DonorNeighbourhoodWindow.getDonorNeighbourhoodWindowMs();
        Map<String, Object> formatted =
                OrderIntentViews.formatOrderIntentLimited(recordWithPhoto(windowMs + 1000, "alice"), NOW, "alice");
        assertEquals("https://cdn/view", formatted.get("reference_photo_view_url"));
        assertEquals("https://cdn/thumb", formatted.get("reference_photo_thumbnail_url"));
    }

    @Test
    void formatOrderIntentLimitedKeepsPhotoUrlsWithinWindow() {
        Map<String, Object> formatted =
                OrderIntentViews.formatOrderIntentLimited(
                        recordWithPhoto(30 * 60 * 1000, "alice"), NOW, "");
        assertEquals("https://cdn/view", formatted.get("reference_photo_view_url"));
    }

    @Test
    void formatOrderIntentForRoleUsesFullViewForCoordinator() {
        long windowMs = DonorNeighbourhoodWindow.getDonorNeighbourhoodWindowMs();
        Map<String, Object> formatted =
                OrderIntentViews.formatOrderIntentForRole(
                        recordWithPhoto(windowMs + 1000, "alice"),
                        "coordinator",
                        Map.of(),
                        NOW,
                        "bob");
        assertEquals("https://cdn/view", formatted.get("reference_photo_view_url"));
    }

    @Test
    void formatOrderIntentCoordinatorIncludesDonorEmailWhenKnown() {
        Map<String, Object> formatted =
                OrderIntentViews.formatOrderIntentCoordinator(
                        recordWithPhoto(0, "alice"), Map.of("alice", "alice@example.com"), NOW);
        assertEquals("alice", formatted.get("user_id"));
        assertEquals("alice@example.com", formatted.get("donor_email"));
        assertEquals("alice@example.com", formatted.get("initiator_email"));
    }

    @Test
    void formatOrderIntentLimitedOmitsDonorEmail() {
        Map<String, Object> formatted =
                OrderIntentViews.formatOrderIntentLimited(recordWithPhoto(0, "alice"), NOW, "");
        assertFalse(formatted.containsKey("donor_email"));
    }

    @Test
    void formatOrderIntentLimitedKeepsCoordinatesForViewerOwnIntent() {
        Map<String, Object> record = recordWithPhoto(0, "alice");
        record.put("location_lat", 12.97);
        record.put("location_lng", 80.22);
        Map<String, Object> formatted = OrderIntentViews.formatOrderIntentLimited(record, NOW, "alice");
        assertEquals(12.97, formatted.get("location_lat"));
        assertEquals(80.22, formatted.get("location_lng"));
    }

    @Test
    void formatOrderIntentLimitedRedactsCoordinatesForOtherDonors() {
        Map<String, Object> record = recordWithPhoto(0, "bob");
        record.put("location_lat", 12.97);
        record.put("location_lng", 80.22);
        Map<String, Object> formatted = OrderIntentViews.formatOrderIntentLimited(record, NOW, "alice");
        assertEquals(null, formatted.get("location_lat"));
        assertEquals(null, formatted.get("location_lng"));
    }
}
