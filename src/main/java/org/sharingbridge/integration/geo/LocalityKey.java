package org.sharingbridge.integration.geo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Hierarchical locality keys: {@code {ISO3166-1}:{ISO3166-2}:{postal}}.
 * Examples: {@code IN:TN:600115}, {@code IN:TN}, {@code IN}. Matches Node {@code localityKey.js}.
 */
public final class LocalityKey {

    private static final Pattern LOCALITY_KEY_PART = Pattern.compile("^[A-Z0-9]{2,10}$");

    private LocalityKey() {}

    public static String normalizeLocalityKey(Object key) {
        String trimmed = jsString(key).trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        String[] parts = trimmed.split(":");
        List<String> normalized = new ArrayList<>();
        for (String part : parts) {
            String p = part.trim().toUpperCase(Locale.ROOT);
            if (!p.isEmpty()) {
                normalized.add(p);
            }
        }
        return String.join(":", normalized);
    }

    public static boolean isValidLocalityKey(Object key) {
        String normalized = normalizeLocalityKey(key);
        if (normalized.isEmpty()) {
            return false;
        }
        String[] parts = normalized.split(":");
        if (parts.length < 1 || parts.length > 3) {
            return false;
        }
        for (String part : parts) {
            if (!LOCALITY_KEY_PART.matcher(part).matches()) {
                return false;
            }
        }
        return true;
    }

    /** Most-specific first: IN:TN:600115 → IN:TN → IN */
    public static List<String> localityKeyChain(Object key) {
        String trimmed = jsString(key).trim();
        if (trimmed.isEmpty()) {
            return List.of();
        }
        String[] parts = trimmed.split(":");
        List<String> chain = new ArrayList<>();
        for (int depth = parts.length; depth >= 1; depth--) {
            chain.add(String.join(":", java.util.Arrays.copyOf(parts, depth)));
        }
        return chain;
    }

    /**
     * True when {@code offerKey} applies to demand at {@code userKey} (equal or ancestor prefix).
     */
    public static boolean offerAppliesToLocality(Object offerKey, Object userKey) {
        String offer = jsString(offerKey).trim();
        String user = jsString(userKey).trim();
        if (offer.isEmpty() || user.isEmpty()) {
            return false;
        }
        if (offer.equals(user)) {
            return true;
        }
        return user.startsWith(offer + ":");
    }

    /**
     * True when a record's locality key equals the filter or is a descendant (deeper segment chain).
     */
    public static boolean recordMatchesLocalityFilter(Object recordKey, Object filterKey) {
        String record = normalizeLocalityKey(recordKey);
        String filter = normalizeLocalityKey(filterKey);
        if (record.isEmpty() || filter.isEmpty()) {
            return false;
        }
        if (record.equals(filter)) {
            return true;
        }
        return record.startsWith(filter + ":");
    }

    /**
     * Pick catalog rows for a resolved user locality; most-specific menu line wins per offer id.
     */
    public static List<Map<String, Object>> resolveStandardOffersForLocality(
            List<? extends Map<String, ?>> offers, Object userLocalityKey) {
        String userKey = jsString(userLocalityKey).trim();
        if (userKey.isEmpty() || offers == null) {
            return List.of();
        }
        Set<String> chain = Set.copyOf(localityKeyChain(userKey));
        List<Map<String, Object>> applicable = new ArrayList<>();
        for (Map<String, ?> offer : offers) {
            if (offer == null) {
                continue;
            }
            Object lk = offer.get("locality_key");
            String locality = jsString(lk).trim();
            if (chain.contains(locality)) {
                applicable.add(new LinkedHashMap<>(offer));
            }
        }
        Map<String, OfferDepth> byOfferId = new LinkedHashMap<>();
        for (Map<String, Object> offer : applicable) {
            Object idObj = offer.get("id");
            if (idObj == null) {
                idObj = offer.get("standard_offer_id");
            }
            String offerId = jsString(idObj).trim();
            if (offerId.isEmpty()) {
                continue;
            }
            Object lk = offer.get("locality_key");
            int depth = jsString(lk).split(":").length;
            OfferDepth existing = byOfferId.get(offerId);
            if (existing == null || depth > existing.depth) {
                byOfferId.put(offerId, new OfferDepth(offer, depth));
            }
        }
        return byOfferId.values().stream()
                .map(entry -> entry.offer)
                .sorted(Comparator.comparing(
                        o -> String.valueOf(o.getOrDefault("menu_label", "")),
                        String::compareTo))
                .collect(Collectors.toList());
    }

    /** Matches JS {@code String(value ?? "")}. */
    private static String jsString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private record OfferDepth(Map<String, Object> offer, int depth) {}
}
