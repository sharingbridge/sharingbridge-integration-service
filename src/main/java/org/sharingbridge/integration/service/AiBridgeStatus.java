package org.sharingbridge.integration.service;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Non-secret AI bridge snapshot for {@code /health}, matching Node {@code aiBridgeStatus.js}.
 */
public final class AiBridgeStatus {

    private AiBridgeStatus() {}

    public static Map<String, Object> fromEnvironment() {
        return build(System.getenv());
    }

    public static Map<String, Object> build(Map<String, String> env) {
        String baseUrl = trim(env.get("AI_ORCHESTRATION_BASE_URL"));
        boolean suggestFlag = envFlag(env.get("AI_SUGGEST_VENDORS_ENABLED"));
        boolean instructionFlag = envFlag(env.get("AI_INSTRUCTION_PACK_ENABLED"));
        boolean baseUrlSet = !baseUrl.isEmpty();

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("orchestration_base_url_set", baseUrlSet);
        status.put("orchestration_host", hostFromUrl(baseUrl));
        status.put("suggest_vendors_flag", suggestFlag);
        status.put("instruction_pack_flag", instructionFlag);
        status.put("suggest_vendors_path_active", baseUrlSet && suggestFlag);
        status.put("instruction_pack_path_active", baseUrlSet && instructionFlag);
        status.put(
                "internal_api_key_set",
                !trim(env.get("AI_ORCHESTRATION_INTERNAL_API_KEY")).isEmpty());
        status.put(
                "suggest_vendors_timeout_ms",
                readNumber(env.get("AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS"), 15_000));
        status.put(
                "instruction_pack_timeout_ms",
                readNumber(env.get("AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS"), 60_000));
        return status;
    }

    public static String hostFromUrl(String rawUrl) {
        String trimmed = trim(rawUrl);
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            URI uri = URI.create(trimmed);
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                int port = uri.getPort();
                if (port > 0 && uri.getAuthority() != null) {
                    return uri.getAuthority();
                }
                return "invalid-url";
            }
            int port = uri.getPort();
            return port > 0 ? host + ":" + port : host;
        } catch (IllegalArgumentException ex) {
            return "invalid-url";
        }
    }

    private static boolean envFlag(String raw) {
        if (raw == null || raw.isBlank()) {
            return false;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "1", "true", "yes", "on" -> true;
            default -> false;
        };
    }

    private static double readNumber(String raw, double fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException ex) {
            return Double.NaN;
        }
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
