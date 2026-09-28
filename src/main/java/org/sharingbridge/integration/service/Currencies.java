package org.sharingbridge.integration.service;

/** Normalizes ISO 4217 currency codes from persistence — never invents a default. */
public final class Currencies {

    private Currencies() {}

    /** @return uppercase ISO code, or null if missing/blank */
    public static String fromDb(Object raw) {
        if (raw == null) {
            return null;
        }
        String text = String.valueOf(raw).trim();
        if (text.isEmpty() || "null".equalsIgnoreCase(text)) {
            return null;
        }
        return text.toUpperCase();
    }
}
