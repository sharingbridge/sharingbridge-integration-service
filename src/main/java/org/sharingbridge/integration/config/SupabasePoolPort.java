package org.sharingbridge.integration.config;

/**
 * Supabase pooler port on {@code *.pooler.supabase.com}.
 * Env {@code DB_SUPABASE_POOL_6543_4TR_5432_4SESN}: {@code 5432} or {@code 6543}.
 */
public enum SupabasePoolPort {
    SESSION(5432),
    TRANSACTION(6543);

    private final int port;

    SupabasePoolPort(int port) {
        this.port = port;
    }

    public int port() {
        return port;
    }

    public static SupabasePoolPort fromEnv(String raw) {
        if (raw == null || raw.isBlank()) {
            return SESSION;
        }
        String trimmed = raw.trim();
        try {
            int value = Integer.parseInt(trimmed);
            for (SupabasePoolPort mode : values()) {
                if (mode.port == value) {
                    return mode;
                }
            }
        } catch (NumberFormatException ignored) {
            // fall through
        }
        throw new IllegalStateException(
                "DB_SUPABASE_POOL_6543_4TR_5432_4SESN must be 5432 (session) or 6543 (transaction); got '"
                        + trimmed + "'.");
    }
}
