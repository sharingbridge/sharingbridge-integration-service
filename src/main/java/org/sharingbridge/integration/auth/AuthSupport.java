package org.sharingbridge.integration.auth;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Bearer extraction and role guards matching Node {@code authContext.js}.
 */
public final class AuthSupport {

    private AuthSupport() {}

    public static String extractBearer(String authorizationHeader) {
        if (authorizationHeader == null) {
            return null;
        }
        String trimmed = authorizationHeader.trim();
        if (!trimmed.toLowerCase(Locale.ROOT).startsWith("bearer ")) {
            return null;
        }
        String token = trimmed.substring(7).trim();
        return token.isEmpty() ? null : token;
    }

    public static AuthContext extractAuthFromAuthorizationHeader(
            String authorizationHeader, JwtService jwtService) {
        String token = extractBearer(authorizationHeader);
        if (token == null) {
            return null;
        }
        try {
            Map<String, Object> payload = jwtService.verify(token);
            Object sub = payload.get("sub");
            Object role = payload.get("role");
            return new AuthContext(
                    sub == null ? null : String.valueOf(sub),
                    Roles.normalizeRole(role == null ? null : String.valueOf(role)));
        } catch (RuntimeException ex) {
            return null;
        }
    }

    public static Optional<AuthError> requireInitiator(AuthContext auth) {
        if (auth == null) {
            return Optional.of(missingAuth());
        }
        if (!Roles.isInitiatorRole(auth.role())) {
            return Optional.of(forbidden("This action requires an initiator account."));
        }
        return Optional.empty();
    }

    public static Optional<AuthError> requireCoordinator(AuthContext auth) {
        if (auth == null) {
            return Optional.of(missingAuth());
        }
        if (!Roles.ROLE_COORDINATOR.equals(auth.role())) {
            return Optional.of(forbidden("This action requires a coordinator account."));
        }
        return Optional.empty();
    }

    public static Optional<AuthError> requireReporter(AuthContext auth) {
        if (auth == null) {
            return Optional.of(missingAuth());
        }
        if (!Roles.isInitiatorRole(auth.role())
                && !Roles.ROLE_COORDINATOR.equals(auth.role())) {
            return Optional.of(
                    forbidden("This action requires an initiator or coordinator account."));
        }
        return Optional.empty();
    }

    public static ResolvedUserId resolveAuthenticatedUserId(String headerUserId, String supplied) {
        if (headerUserId == null || headerUserId.isBlank()) {
            return new ResolvedUserId(null, missingAuth());
        }
        if (supplied != null && !supplied.isBlank() && !headerUserId.equals(supplied)) {
            return new ResolvedUserId(
                    null,
                    new AuthError(
                            403,
                            Map.of(
                                    "code", "user_id_mismatch",
                                    "message",
                                    "user_id in payload does not match the authenticated user_id.")));
        }
        return new ResolvedUserId(headerUserId, null);
    }

    private static AuthError missingAuth() {
        return new AuthError(
                401,
                Map.of(
                        "code", "missing_auth_context",
                        "message", "A valid Bearer token is required."));
    }

    private static AuthError forbidden(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", "forbidden");
        body.put("message", message);
        return new AuthError(403, body);
    }

    public record AuthError(int status, Map<String, Object> body) {}

    public record ResolvedUserId(String userId, AuthError error) {}
}
