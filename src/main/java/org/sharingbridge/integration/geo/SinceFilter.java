package org.sharingbridge.integration.geo;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.sharingbridge.integration.auth.Roles;

public final class SinceFilter {

    private static final Pattern SINCE = Pattern.compile("^(\\d+(?:\\.\\d+)?)(h|m|d)$");
    private static final long INITIATOR_HISTORY_MS = 7L * 86_400_000L;

    private SinceFilter() {}

    public static long getDonorListSinceMs() {
        return DonorNeighbourhoodWindow.getDonorNeighbourhoodWindowMs();
    }

    public static long getInitiatorHistorySinceMs() {
        return INITIATOR_HISTORY_MS;
    }

    public static long intentActivityMs(Map<String, Object> record) {
        Object raw = record.get("updated_at");
        if (raw == null) {
            raw = record.get("created_at");
        }
        return parseIsoMs(raw);
    }

    public static Long parseSinceQuery(Object value) {
        if (value == null || String.valueOf(value).isEmpty()) {
            return null;
        }
        String raw = String.valueOf(value).trim().toLowerCase();
        Matcher match = SINCE.matcher(raw);
        if (!match.matches()) {
            return null;
        }
        try {
            double amount = Double.parseDouble(match.group(1));
            if (!Double.isFinite(amount) || amount <= 0) {
                return null;
            }
            long unitMs = switch (match.group(2)) {
                case "m" -> 60_000L;
                case "h" -> 3_600_000L;
                case "d" -> 86_400_000L;
                default -> 0L;
            };
            return (long) (amount * unitMs);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public static String formatSinceQuery(long sinceMs) {
        if (sinceMs % 3_600_000L == 0) {
            return (sinceMs / 3_600_000L) + "h";
        }
        if (sinceMs % 60_000L == 0) {
            return (sinceMs / 60_000L) + "m";
        }
        return sinceMs + "ms";
    }

    public static Long resolveListSinceMs(String role, String querySince, String neighbourhoodMode) {
        Long parsed = parseSinceQuery(querySince);
        if (Roles.isCoordinatorApiRole(role)) {
            return parsed;
        }
        boolean neighbourhoodActive =
                "near".equals(neighbourhoodMode) || "locality".equals(neighbourhoodMode);
        long maxMs = neighbourhoodActive ? getDonorListSinceMs() : getInitiatorHistorySinceMs();
        if (parsed == null) {
            return maxMs;
        }
        return Math.min(parsed, maxMs);
    }

    public static List<Map<String, Object>> filterRecordsSince(
            List<Map<String, Object>> records, Long sinceMs, long nowMs) {
        if (sinceMs == null || sinceMs <= 0) {
            return records;
        }
        long cutoff = nowMs - sinceMs;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> record : records) {
            if (intentActivityMs(record) >= cutoff) {
                out.add(record);
            }
        }
        return out;
    }

    public static long parseIsoMs(Object raw) {
        if (raw == null) {
            return 0;
        }
        try {
            return Instant.parse(String.valueOf(raw)).toEpochMilli();
        } catch (RuntimeException ex) {
            return 0;
        }
    }
}
