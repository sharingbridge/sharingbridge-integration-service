package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.Map;

public final class EmailShareConsent {

    private EmailShareConsent() {}

    public static String validateEmailShareConsent(Map<String, Object> payload) {
        if (payload != null && Boolean.TRUE.equals(payload.get("email_share_consent"))) {
            return null;
        }
        return "email_share_consent must be true — login email may be shared with the eco kitchen for off-platform coordination.";
    }

    public static String emailShareConsentTimestamp(Map<String, Object> payload) {
        if (payload != null && Boolean.TRUE.equals(payload.get("email_share_consent"))) {
            return Instant.now().toString();
        }
        return null;
    }
}
