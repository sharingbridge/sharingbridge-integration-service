package org.sharingbridge.integration.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.sharingbridge.integration.config.AuthProperties;

/**
 * HS256 mint + verify matching Node {@code tokenService.js} (base64url HMAC-SHA256).
 */
public class JwtService {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final AuthProperties properties;

    public JwtService(AuthProperties properties) {
        this.properties = properties;
    }

    public String mint(String userId) {
        return mint(userId, Map.of());
    }

    public String mint(String userId, Map<String, Object> options) {
        String secret = stringOption(options, "secret", properties.getSecret());
        String issuer = stringOption(options, "issuer", properties.getIssuer());
        String audience = stringOption(options, "audience", properties.getAudience());
        long ttlSeconds = longOption(options, "ttlSeconds", 3600L);
        long now = System.currentTimeMillis() / 1000L;
        String roleRaw = stringOption(options, "role", null);
        String role = (roleRaw != null && !roleRaw.isBlank()) ? roleRaw.trim() : "initiator";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", userId);
        payload.put("role", role);
        payload.put("iss", issuer);
        payload.put("aud", audience);
        payload.put("iat", now);
        payload.put("exp", now + ttlSeconds);

        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "HS256");
        header.put("typ", "JWT");

        String encodedHeader = base64UrlEncodeJson(header);
        String encodedPayload = base64UrlEncodeJson(payload);
        String signature = sign(encodedHeader + "." + encodedPayload, secret);
        return encodedHeader + "." + encodedPayload + "." + signature;
    }

    public Map<String, Object> verify(String token) {
        return verify(token, Map.of());
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> verify(String token, Map<String, Object> options) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Token is required.");
        }
        String secret = stringOption(options, "secret", properties.getSecret());
        String issuer = stringOption(options, "issuer", properties.getIssuer());
        String audience = stringOption(options, "audience", properties.getAudience());

        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("Token format is invalid.");
        }
        String encodedHeader = parts[0];
        String encodedPayload = parts[1];
        String encodedSignature = parts[2];
        String expectedSignature = sign(encodedHeader + "." + encodedPayload, secret);
        if (!timingSafeEqual(encodedSignature, expectedSignature)) {
            throw new IllegalArgumentException("Token signature is invalid.");
        }

        Map<String, Object> payload;
        try {
            byte[] json = java.util.Base64.getUrlDecoder().decode(encodedPayload);
            payload = JSON.readValue(json, Map.class);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Token payload is invalid.", ex);
        }

        long now = System.currentTimeMillis() / 1000L;
        if (!issuer.equals(payload.get("iss"))) {
            throw new IllegalArgumentException("Token issuer is invalid.");
        }
        if (!audience.equals(payload.get("aud"))) {
            throw new IllegalArgumentException("Token audience is invalid.");
        }
        Object expObj = payload.get("exp");
        if (!(expObj instanceof Number) || ((Number) expObj).longValue() <= now) {
            throw new IllegalArgumentException("Token is expired.");
        }
        Object subObj = payload.get("sub");
        if (!(subObj instanceof String) || ((String) subObj).isBlank()) {
            throw new IllegalArgumentException("Token subject is invalid.");
        }
        return payload;
    }

    private static String sign(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to sign JWT.", ex);
        }
    }

    private static String base64UrlEncodeJson(Object value) {
        try {
            byte[] json = JSON.writeValueAsBytes(value);
            return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(json);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to encode JWT JSON.", ex);
        }
    }

    static boolean timingSafeEqual(String a, String b) {
        byte[] left = a.getBytes(StandardCharsets.UTF_8);
        byte[] right = b.getBytes(StandardCharsets.UTF_8);
        if (left.length != right.length) {
            return false;
        }
        return MessageDigest.isEqual(left, right);
    }

    private static String stringOption(Map<String, Object> options, String key, String fallback) {
        Object value = options.get(key);
        if (value instanceof String s && !s.isBlank()) {
            return s;
        }
        return fallback;
    }

    private static long longOption(Map<String, Object> options, String key, long fallback) {
        Object value = options.get(key);
        if (value instanceof Number n) {
            return n.longValue();
        }
        return fallback;
    }
}
