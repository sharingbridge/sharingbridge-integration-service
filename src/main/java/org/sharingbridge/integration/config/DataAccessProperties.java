package org.sharingbridge.integration.config;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Pool + retry settings from environment (no secrets). Same names as user-service.
 */
public class DataAccessProperties {

    public static final String POOLING_KEY = "DB_POOLING";
    public static final String POOL_MIN_KEY = "DB_POOL_MIN";
    public static final String POOL_MAX_KEY = "DB_POOL_MAX";
    public static final String IDLE_KEY = "DB_CONNECTION_IDLE_LIFETIME_SECONDS";
    public static final String TIMEOUT_KEY = "DB_TIMEOUT_SECONDS";
    public static final String COMMAND_TIMEOUT_KEY = "DB_COMMAND_TIMEOUT_SECONDS";
    public static final String SUPABASE_POOL_KEY = "DB_SUPABASE_POOL_6543_4TR_5432_4SESN";
    public static final String RETRY_MAX_KEY = "DB_RETRY_MAX_ATTEMPTS";
    public static final String RETRY_BASE_KEY = "DB_RETRY_BASE_DELAY_MS";

    private boolean pooling = true;
    private int poolMin = 0;
    private int poolMax = 5;
    private int connectionIdleLifetimeSeconds = 60;
    private int timeoutSeconds = 30;
    private int commandTimeoutSeconds = 30;
    private SupabasePoolPort supabasePoolPort = SupabasePoolPort.SESSION;
    private int retryMaxAttempts = 3;
    private int retryBaseDelayMs = 200;

    public static DataAccessProperties fromEnvironment() {
        DataAccessProperties props = new DataAccessProperties();
        props.pooling = readBool(env(POOLING_KEY), true);
        props.poolMin = readInt(env(POOL_MIN_KEY), 0, 0, 100);
        props.poolMax = readInt(env(POOL_MAX_KEY), 5, 1, 100);
        props.connectionIdleLifetimeSeconds = readInt(env(IDLE_KEY), 60, 1, 3600);
        props.timeoutSeconds = readInt(env(TIMEOUT_KEY), 30, 1, 300);
        props.commandTimeoutSeconds = readInt(env(COMMAND_TIMEOUT_KEY), 30, 1, 300);
        props.supabasePoolPort = SupabasePoolPort.fromEnv(env(SUPABASE_POOL_KEY));
        props.retryMaxAttempts = readInt(env(RETRY_MAX_KEY), 3, 1, 10);
        props.retryBaseDelayMs = readInt(env(RETRY_BASE_KEY), 200, 0, 30_000);
        return props;
    }

    public record JdbcParts(String url, String username, String password) {}

    public JdbcParts toJdbcParts(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException("DATABASE_URL is empty.");
        }
        String value = raw.trim().replaceAll("^[\"']|[\"']$", "");
        if (value.toLowerCase(Locale.ROOT).startsWith("postgres://")) {
            value = "postgresql://" + value.substring("postgres://".length());
        }
        if (!value.contains("://")) {
            String jdbc = value.startsWith("jdbc:") ? value : "jdbc:" + value;
            return new JdbcParts(jdbc, "", "");
        }

        URI uri;
        try {
            uri = new URI(value);
        } catch (URISyntaxException ex) {
            throw new IllegalStateException(
                    "DATABASE_URL looks like a URI but could not be parsed.", ex);
        }

        String userInfo = uri.getUserInfo() == null ? "" : uri.getUserInfo();
        String[] parts = userInfo.split(":", 2);
        String username = parts.length > 0 ? urlDecode(parts[0]) : "";
        String password = parts.length > 1 ? urlDecode(parts[1]) : "";
        String database = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
        if (database.isBlank()) {
            database = "postgres";
        }

        int port = uri.getPort() > 0 ? uri.getPort() : 5432;
        String host = uri.getHost() == null ? "" : uri.getHost();
        if (host.toLowerCase(Locale.ROOT).contains("pooler.supabase.com")) {
            port = supabasePoolPort.port();
        }

        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
                .append(host)
                .append(':')
                .append(port)
                .append('/')
                .append(database);

        Map<String, String> query = parseQuery(uri.getRawQuery());
        String sslMode = query.getOrDefault("sslmode", query.get("sslMode"));
        boolean isLocal = host.equalsIgnoreCase("localhost")
                || host.equals("127.0.0.1")
                || host.equals("::1");
        if (!isLocal && (sslMode == null || sslMode.isBlank()
                || sslMode.equalsIgnoreCase("prefer")
                || sslMode.equalsIgnoreCase("allow")
                || sslMode.equalsIgnoreCase("disable"))) {
            sslMode = "require";
        }
        if (sslMode != null && !sslMode.isBlank()) {
            jdbc.append("?sslmode=").append(sslMode);
        }

        return new JdbcParts(jdbc.toString(), username, password);
    }

    public Map<String, Object> toPublicConfig() {
        Map<String, Object> map = new HashMap<>();
        map.put("pooling", pooling);
        map.put("pool_min", poolMin);
        map.put("pool_max", poolMax);
        map.put("connection_idle_lifetime_seconds", connectionIdleLifetimeSeconds);
        map.put("timeout_seconds", timeoutSeconds);
        map.put("command_timeout_seconds", commandTimeoutSeconds);
        map.put("supabase_pool_6543_4tr_5432_4sesn", supabasePoolPort.port());
        map.put("retry_max_attempts", retryMaxAttempts);
        map.put("retry_base_delay_ms", retryBaseDelayMs);
        return map;
    }

    private static Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> map = new HashMap<>();
        if (rawQuery == null || rawQuery.isBlank()) {
            return map;
        }
        for (String part : rawQuery.split("&")) {
            String[] kv = part.split("=", 2);
            String key = urlDecode(kv[0]).trim();
            String val = kv.length > 1 ? urlDecode(kv[1]).trim() : "";
            map.put(key, val);
        }
        return map;
    }

    private static String urlDecode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static String env(String key) {
        return System.getenv(key);
    }

    private static boolean readBool(String raw, boolean fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "1", "true", "yes", "on" -> true;
            case "0", "false", "no", "off" -> false;
            default -> fallback;
        };
    }

    private static int readInt(String raw, int fallback, int min, int max) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            int value = Integer.parseInt(raw.trim());
            return Math.max(min, Math.min(max, value));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    public boolean isPooling() {
        return pooling;
    }

    public int getPoolMin() {
        return poolMin;
    }

    public int getPoolMax() {
        return poolMax;
    }

    public int getConnectionIdleLifetimeSeconds() {
        return connectionIdleLifetimeSeconds;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public int getCommandTimeoutSeconds() {
        return commandTimeoutSeconds;
    }

    public SupabasePoolPort getSupabasePoolPort() {
        return supabasePoolPort;
    }

    public int getRetryMaxAttempts() {
        return retryMaxAttempts;
    }

    public int getRetryBaseDelayMs() {
        return retryBaseDelayMs;
    }
}
