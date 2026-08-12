package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.sharingbridge.integration.repository.DeviceTokenRepository;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class DeviceTokenService {

    private final DeviceTokenRepository repository;

    public DeviceTokenService(@Autowired(required = false) DeviceTokenRepository repository) {
        this.repository = repository;
    }

    public Map<String, Object> upsert(String userId, Map<String, Object> payload) {
        if (repository == null) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "device_tokens_unavailable",
                    "Device token storage is not configured.");
        }
        String validationError = validateUpsertDeviceTokenRequest(payload);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        Map<String, Object> record = buildDeviceTokenRecord(payload, userId);
        Map<String, Object> saved = repository.upsertForUser(userId, record);
        Map<String, Object> deviceToken = new LinkedHashMap<>();
        deviceToken.put("user_id", saved.get("user_id"));
        deviceToken.put("platform", saved.get("platform"));
        deviceToken.put("updated_at", saved.get("updated_at"));
        return Map.of("device_token", deviceToken);
    }

    public static String validateUpsertDeviceTokenRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        if (!isNonEmptyString(payload.get("fcm_token"))) {
            return "fcm_token is required.";
        }
        Object platformObj = payload.get("platform");
        String platform =
                platformObj instanceof String s ? s.trim() : "android";
        if (platform.isEmpty()) {
            return "platform must be a non-empty string.";
        }
        return null;
    }

    public static Map<String, Object> buildDeviceTokenRecord(
            Map<String, Object> payload, String userId) {
        String now = Instant.now().toString();
        String platform =
                payload.get("platform") instanceof String s && !s.trim().isEmpty()
                        ? s.trim()
                        : "android";
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("user_id", userId);
        record.put("fcm_token", String.valueOf(payload.get("fcm_token")).trim());
        record.put("platform", platform);
        record.put("updated_at", now);
        return record;
    }

    private static boolean isNonEmptyString(Object value) {
        return value instanceof String s && !s.trim().isEmpty();
    }
}
