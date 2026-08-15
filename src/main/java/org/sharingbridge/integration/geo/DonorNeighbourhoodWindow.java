package org.sharingbridge.integration.geo;

import org.sharingbridge.integration.config.EnvLegacy;

public final class DonorNeighbourhoodWindow {

    public static final int DEFAULT_HOURS = 2;
    public static final int MIN_HOURS = 1;
    public static final int MAX_HOURS = 72;

    private DonorNeighbourhoodWindow() {}

    public static int parseDonorNeighbourhoodWindowHours(Object raw) {
        String text = raw == null ? String.valueOf(DEFAULT_HOURS) : String.valueOf(raw).trim();
        try {
            double parsed = Double.parseDouble(text);
            if (!Double.isFinite(parsed)) {
                return DEFAULT_HOURS;
            }
            return Math.min(MAX_HOURS, Math.max(MIN_HOURS, (int) Math.round(parsed)));
        } catch (NumberFormatException ex) {
            return DEFAULT_HOURS;
        }
    }

    public static int getDonorNeighbourhoodWindowHours() {
        return parseDonorNeighbourhoodWindowHours(
                EnvLegacy.readEnvWithLegacy(
                        "INITIATOR_NEIGHBOURHOOD_WINDOW_HOURS",
                        "DONOR_NEIGHBOURHOOD_WINDOW_HOURS"));
    }

    public static long getDonorNeighbourhoodWindowMs() {
        return getDonorNeighbourhoodWindowHours() * 60L * 60L * 1000L;
    }

    public static String getDonorNeighbourhoodSinceQuery() {
        return getDonorNeighbourhoodWindowHours() + "h";
    }
}
