package org.sharingbridge.integration.config;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * CORS origins from {@code WEB_CORS_ORIGINS}, matching Node {@code cors.js}.
 */
public class CorsProperties {

    private final boolean allowAll;
    private final Set<String> origins;

    public CorsProperties(boolean allowAll, Set<String> origins) {
        this.allowAll = allowAll;
        this.origins = Collections.unmodifiableSet(origins);
    }

    public static CorsProperties fromEnvironment() {
        return parse(System.getenv("WEB_CORS_ORIGINS"));
    }

    public static CorsProperties parse(String envValue) {
        String raw = envValue == null ? "" : envValue.trim();
        if (raw.isEmpty()) {
            return new CorsProperties(false, Set.of());
        }
        if ("*".equals(raw)) {
            return new CorsProperties(true, Set.of());
        }
        Set<String> origins = new LinkedHashSet<>();
        for (String part : raw.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                origins.add(trimmed);
            }
        }
        return new CorsProperties(false, origins);
    }

    public boolean isAllowAll() {
        return allowAll;
    }

    public Set<String> getOrigins() {
        return origins;
    }

    /**
     * @return allow-origin value to echo, or {@code null} if request origin is not allowed
     */
    public String resolveAllowOrigin(String requestOrigin) {
        if (requestOrigin == null) {
            return null;
        }
        String trimmed = requestOrigin.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (allowAll) {
            return trimmed;
        }
        if (origins.contains(trimmed)) {
            return trimmed;
        }
        return null;
    }
}
