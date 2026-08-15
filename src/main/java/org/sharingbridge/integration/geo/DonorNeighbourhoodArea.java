package org.sharingbridge.integration.geo;

public final class DonorNeighbourhoodArea {

    public static final int DEFAULT_RADIUS_M = 5000;
    public static final int MAX_RADIUS_M = 50_000;

    private DonorNeighbourhoodArea() {}

    public static int parseDonorNeighbourhoodRadiusM(Object raw) {
        if (raw == null || String.valueOf(raw).trim().isEmpty()) {
            return DEFAULT_RADIUS_M;
        }
        try {
            double parsed = Double.parseDouble(String.valueOf(raw).trim());
            if (!Double.isFinite(parsed) || parsed <= 0) {
                return DEFAULT_RADIUS_M;
            }
            return Math.min(MAX_RADIUS_M, (int) Math.round(parsed));
        } catch (NumberFormatException ex) {
            return DEFAULT_RADIUS_M;
        }
    }

    public static int getDonorNeighbourhoodRadiusM() {
        return parseDonorNeighbourhoodRadiusM(System.getenv("INITIATOR_NEIGHBOURHOOD_RADIUS_M"));
    }

    public static Double parseGeoCoord(Object value, String kind) {
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            return null;
        }
        try {
            double n = Double.parseDouble(String.valueOf(value).trim());
            if (!Double.isFinite(n)) {
                return null;
            }
            if ("lat".equals(kind)) {
                return n >= -90 && n <= 90 ? n : null;
            }
            return n >= -180 && n <= 180 ? n : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public record NeighbourhoodQuery(
            Double nearLat, Double nearLng, String localityKey, int radiusM) {}

    public static NeighbourhoodQuery parseNeighbourhoodQuery(
            String nearLatRaw, String nearLngRaw, String localityKeyRaw, String radiusRaw) {
        Double nearLat = parseGeoCoord(nearLatRaw, "lat");
        Double nearLng = parseGeoCoord(nearLngRaw, "lng");
        String localityKey = LocalityKey.normalizeLocalityKey(localityKeyRaw == null ? "" : localityKeyRaw);
        int radiusM = getDonorNeighbourhoodRadiusM();
        if (radiusRaw != null && !radiusRaw.isBlank()) {
            try {
                double parsed = Double.parseDouble(radiusRaw.trim());
                if (Double.isFinite(parsed) && parsed > 0) {
                    radiusM = Math.min((int) Math.round(parsed), getDonorNeighbourhoodRadiusM());
                }
            } catch (NumberFormatException ignored) {
                // keep default
            }
        }
        return new NeighbourhoodQuery(
                nearLat, nearLng, localityKey.isEmpty() ? null : localityKey, radiusM);
    }
}
