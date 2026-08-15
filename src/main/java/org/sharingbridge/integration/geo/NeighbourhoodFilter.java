package org.sharingbridge.integration.geo;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.auth.Roles;
import org.sharingbridge.integration.service.OrderIntentLocation;

public final class NeighbourhoodFilter {

    public static final double EARTH_RADIUS_M = 6_371_000;

    private NeighbourhoodFilter() {}

    public sealed interface Scope permits NearScope, LocalityScope {}

    public record NearScope(double nearLat, double nearLng, int radiusM) implements Scope {}

    public record LocalityScope(String localityKey) implements Scope {}

    public static double haversineDistanceM(
            double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1))
                        * Math.cos(Math.toRadians(lat2))
                        * Math.sin(dLng / 2)
                        * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
    }

    public static boolean intentMatchesNeighbourhood(Map<String, Object> record, Scope scope) {
        if (scope instanceof LocalityScope locality) {
            return LocalityKey.recordMatchesLocalityFilter(
                    record.get("locality_key"), locality.localityKey());
        }
        if (!OrderIntentLocation.recordHasLocation(record)) {
            return false;
        }
        NearScope near = (NearScope) scope;
        double distance = haversineDistanceM(
                near.nearLat(),
                near.nearLng(),
                toDouble(record.get("location_lat")),
                toDouble(record.get("location_lng")));
        return distance <= near.radiusM();
    }

    public static Scope resolveNeighbourhoodScope(
            String role, String nearLat, String nearLng, String localityKey, String radiusM) {
        DonorNeighbourhoodArea.NeighbourhoodQuery query =
                DonorNeighbourhoodArea.parseNeighbourhoodQuery(
                        nearLat, nearLng, localityKey, radiusM);
        if (query.nearLat() != null && query.nearLng() != null) {
            return new NearScope(query.nearLat(), query.nearLng(), query.radiusM());
        }
        if (query.localityKey() != null) {
            return new LocalityScope(query.localityKey());
        }
        return null;
    }

    public static List<Map<String, Object>> filterRecordsByNeighbourhood(
            List<Map<String, Object>> records, Scope scope, String viewerUserId, String role) {
        String viewer = viewerUserId == null ? "" : viewerUserId.trim();
        if (scope == null) {
            if (viewer.isEmpty() || Roles.isCoordinatorApiRole(role)) {
                return records;
            }
            List<Map<String, Object>> own = new ArrayList<>();
            for (Map<String, Object> record : records) {
                if (viewer.equals(record.get("user_id"))) {
                    own.add(record);
                }
            }
            return own;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> record : records) {
            if (!viewer.isEmpty() && viewer.equals(record.get("user_id"))) {
                out.add(record);
                continue;
            }
            if (!OrderIntentLocation.recordHasLocation(record)) {
                if (scope instanceof LocalityScope locality) {
                    if (LocalityKey.recordMatchesLocalityFilter(
                            record.get("locality_key"), locality.localityKey())) {
                        out.add(record);
                    }
                }
                continue;
            }
            if (intentMatchesNeighbourhood(record, scope)) {
                out.add(record);
            }
        }
        return out;
    }

    /** Node {@code scope?.type}: {@code near}, {@code locality}, or null. */
    public static String type(Scope scope) {
        if (scope instanceof NearScope) {
            return "near";
        }
        if (scope instanceof LocalityScope) {
            return "locality";
        }
        return null;
    }

    public static Map<String, Object> formatNeighbourhoodResponse(
            Scope scope, String viewerLocalityKey) {
        if (scope == null) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        if (scope instanceof LocalityScope locality) {
            out.put("mode", "locality_key");
            out.put("locality_key", locality.localityKey());
            return out;
        }
        NearScope near = (NearScope) scope;
        out.put("mode", "near");
        out.put("near_lat", near.nearLat());
        out.put("near_lng", near.nearLng());
        out.put("radius_m", near.radiusM());
        out.put("viewer_locality_key", viewerLocalityKey);
        return out;
    }

    private static double toDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        return Double.parseDouble(String.valueOf(value));
    }
}
