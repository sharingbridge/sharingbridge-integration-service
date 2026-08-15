package org.sharingbridge.integration.service;

import java.util.LinkedHashMap;
import java.util.Map;
import org.sharingbridge.integration.geo.DonorNeighbourhoodArea;
import org.sharingbridge.integration.geo.LocalityKey;

public final class OrderIntentLocation {

    private OrderIntentLocation() {}

    public record Location(double lat, double lng, String label, String localityKey) {}

    public static Location locationFromPayload(
            Map<String, Object> payload, PostalGeocodeService geocode) {
        if (payload == null) {
            return null;
        }
        Double lat = DonorNeighbourhoodArea.parseGeoCoord(payload.get("location_lat"), "lat");
        Double lng = DonorNeighbourhoodArea.parseGeoCoord(payload.get("location_lng"), "lng");
        if (lat == null || lng == null) {
            return null;
        }
        String label = payload.get("location_label") instanceof String text ? text.trim() : "";
        String suppliedKey =
                payload.get("locality_key") instanceof String text ? text.trim() : "";
        String localityKey = "";
        if (!suppliedKey.isEmpty() && LocalityKey.isValidLocalityKey(suppliedKey)) {
            localityKey = suppliedKey;
        } else if (geocode != null) {
            String derived = geocode.derivePostalLocalityKey(lat, lng);
            localityKey = derived == null ? "" : derived;
        }
        return new Location(lat, lng, label, localityKey);
    }

    public static Map<String, Object> applyLocationToRecord(
            Map<String, Object> record, Location location) {
        Map<String, Object> next = new LinkedHashMap<>(record);
        if (location == null) {
            next.put("location_lat", null);
            next.put("location_lng", null);
            next.put("location_label", "");
            next.put("locality_key", "");
            return next;
        }
        next.put("location_lat", location.lat());
        next.put("location_lng", location.lng());
        next.put("location_label", location.label());
        next.put("locality_key", location.localityKey());
        return next;
    }

    public static Map<String, Object> mergeLocationFromPayload(
            Map<String, Object> existing, Map<String, Object> payload, PostalGeocodeService geocode) {
        Location incoming = locationFromPayload(payload, geocode);
        if (incoming != null) {
            return applyLocationToRecord(existing, incoming);
        }
        if (payload != null
                && payload.get("location_lat") == null
                && payload.containsKey("location_lat")
                && payload.get("location_lng") == null
                && payload.containsKey("location_lng")) {
            return applyLocationToRecord(existing, null);
        }
        return existing;
    }

    public static boolean recordHasLocation(Map<String, Object> record) {
        if (record == null) {
            return false;
        }
        Object lat = record.get("location_lat");
        Object lng = record.get("location_lng");
        return lat instanceof Number
                && lng instanceof Number
                && Double.isFinite(((Number) lat).doubleValue())
                && Double.isFinite(((Number) lng).doubleValue());
    }
}
