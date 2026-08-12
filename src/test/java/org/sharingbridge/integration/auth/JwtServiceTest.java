package org.sharingbridge.integration.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.config.AuthProperties;

class JwtServiceTest {

    private final JwtService jwtService = new JwtService(AuthProperties.fromEnvironment());

    @Test
    void mintThenVerify() {
        String token = jwtService.mint("user-1", Map.of("role", "coordinator"));
        Map<String, Object> payload = jwtService.verify(token);
        assertEquals("user-1", payload.get("sub"));
        assertEquals("coordinator", payload.get("role"));
        assertEquals(AuthProperties.DEFAULT_ISSUER, payload.get("iss"));
        assertEquals(AuthProperties.DEFAULT_AUDIENCE, payload.get("aud"));
    }

    @Test
    void wrongSecretFails() {
        String token = jwtService.mint("user-1");
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> jwtService.verify(token, Map.of("secret", "other-secret")));
        assertTrue(ex.getMessage().contains("signature"));
    }

    @Test
    void expiredFails() {
        String token = jwtService.mint("user-1", Map.of("ttlSeconds", -10));
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> jwtService.verify(token));
        assertTrue(ex.getMessage().toLowerCase().contains("expired"));
    }
}
