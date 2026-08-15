package org.sharingbridge.integration.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/** JS-adjacent helpers so domain ports match Node quirks. */
public final class JsValues {

    private static final String BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

    private JsValues() {}

    public static boolean isNonEmptyString(Object value) {
        return value instanceof String text && !text.trim().isEmpty();
    }

    public static String optionalTrimmed(Object value) {
        return value instanceof String text ? text.trim() : "";
    }

    public static String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    public static Double jsNumber(Object value) {
        if (value == null) {
            return Double.NaN;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            return Double.NaN;
        }
    }

    public static boolean isFiniteNumber(Object value) {
        if (!(value instanceof Number number)) {
            return false;
        }
        double n = number.doubleValue();
        return Double.isFinite(n);
    }

    public static Integer parseUnits(Object value, int max) {
        double n = jsNumber(value);
        if (!Double.isFinite(n) || n < 1) {
            return null;
        }
        return Math.min(max, (int) Math.round(n));
    }

    public static Integer parseMealUnits(Object value) {
        if (value == null) {
            return 1;
        }
        return parseUnits(value, 50);
    }

    public static String randomPrefixedId(String prefix) {
        StringBuilder rand = new StringBuilder(6);
        ThreadLocalRandom random = ThreadLocalRandom.current();
        for (int i = 0; i < 6; i++) {
            rand.append(BASE36.charAt(random.nextInt(BASE36.length())));
        }
        return prefix + System.currentTimeMillis() + "-" + rand;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> asObjectMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                out.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return out;
        }
        return null;
    }

    public static List<?> asArray(Object value) {
        return value instanceof List<?> list ? list : null;
    }

    public static Map<String, Object> copy(Map<String, Object> source) {
        return source == null ? new LinkedHashMap<>() : new LinkedHashMap<>(source);
    }
}
