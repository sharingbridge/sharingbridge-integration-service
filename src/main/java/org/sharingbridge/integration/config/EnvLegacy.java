package org.sharingbridge.integration.config;

/** Read a config env var with a legacy fallback name (donor → initiator). */
public final class EnvLegacy {

    private EnvLegacy() {}

    public static String readEnvWithLegacy(String primary, String legacy) {
        String primaryRaw = System.getenv(primary);
        if (primaryRaw != null && !primaryRaw.trim().isEmpty()) {
            return primaryRaw.trim();
        }
        String legacyRaw = System.getenv(legacy);
        if (legacyRaw != null && !legacyRaw.trim().isEmpty()) {
            return legacyRaw.trim();
        }
        return null;
    }
}
