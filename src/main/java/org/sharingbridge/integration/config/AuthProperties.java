package org.sharingbridge.integration.config;

/**
 * JWT settings matching Node {@code tokenService.js} / user-service.
 */
public class AuthProperties {

    public static final String DEFAULT_SECRET = "sharingbridge-dev-secret-change-me";
    public static final String DEFAULT_ISSUER = "sharingbridge-user-service";
    public static final String DEFAULT_AUDIENCE = "sharingbridge-clients";

    private final String secret;
    private final String issuer;
    private final String audience;

    public AuthProperties(String secret, String issuer, String audience) {
        this.secret = secret;
        this.issuer = issuer;
        this.audience = audience;
    }

    public static AuthProperties fromEnvironment() {
        return new AuthProperties(
                firstNonBlank(System.getenv("AUTH_TOKEN_SECRET"), DEFAULT_SECRET),
                firstNonBlank(System.getenv("AUTH_TOKEN_ISSUER"), DEFAULT_ISSUER),
                firstNonBlank(System.getenv("AUTH_TOKEN_AUDIENCE"), DEFAULT_AUDIENCE));
    }

    private static String firstNonBlank(String value, String fallback) {
        if (value != null && !value.isBlank()) {
            return value.trim();
        }
        return fallback;
    }

    public String getSecret() {
        return secret;
    }

    public String getIssuer() {
        return issuer;
    }

    public String getAudience() {
        return audience;
    }
}
