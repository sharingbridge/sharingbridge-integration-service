package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.client.UserServicePreferencesClient;
import org.sharingbridge.integration.client.UserServicePreferencesException;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class PreferencesService {

    private final UserServicePreferencesClient client;

    public PreferencesService(UserServicePreferencesClient client) {
        this.client = client;
    }

    public Map<String, Object> list(String userId, String authorization) {
        requireUserId(userId);
        try {
            List<Map<String, Object>> presets = client.listByUser(userId, authorization);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("user_id", userId);
            body.put("presets", presets);
            return body;
        } catch (UserServicePreferencesException ex) {
            throw mapListError(ex);
        }
    }

    public Map<String, Object> save(
            String userId, Map<String, Object> payload, String authorization) {
        String validationError = validateSavePresetsRequest(payload);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> presets = (List<Map<String, Object>>) payload.get("presets");
        String now = Instant.now().toString();
        List<Map<String, Object>> created = new ArrayList<>();
        for (int i = 0; i < presets.size(); i++) {
            Map<String, Object> preset = new LinkedHashMap<>(presets.get(i));
            preset.put("id", userId + "-preset-" + System.currentTimeMillis() + "-" + (i + 1));
            preset.put("saved_at", now);
            created.add(preset);
        }
        try {
            List<Map<String, Object>> updated = client.upsertForUser(userId, created, authorization);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("user_id", userId);
            body.put("saved_count", created.size());
            body.put("total_count", updated.size());
            body.put(
                    "preset_ids",
                    created.stream().map(item -> String.valueOf(item.get("id"))).toList());
            body.put("saved_at", now);
            return body;
        } catch (UserServicePreferencesException ex) {
            throw mapMutationError(ex, "Unable to persist presets");
        }
    }

    public Map<String, Object> clear(String userId, String authorization) {
        requireUserId(userId);
        try {
            client.clearForUser(userId, authorization);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("user_id", userId);
            body.put("presets", List.of());
            body.put("cleared", true);
            return body;
        } catch (UserServicePreferencesException ex) {
            throw mapMutationError(ex, "Unable to clear presets");
        }
    }

    public Map<String, Object> deleteItem(
            String userId, Map<String, Object> payload, String authorization) {
        String validationError = validateDeletePresetItemRequest(payload);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        String restaurantName = String.valueOf(payload.get("restaurant_name")).trim();
        String orderUrl = String.valueOf(payload.get("order_url")).trim();
        try {
            List<Map<String, Object>> presets =
                    client.removePresetForUser(userId, restaurantName, orderUrl, authorization);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("user_id", userId);
            body.put("presets", presets);
            return body;
        } catch (UserServicePreferencesException ex) {
            throw mapMutationError(ex, "Unable to remove preset");
        }
    }

    public static String validateSavePresetsRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        Object presetsObj = payload.get("presets");
        if (!(presetsObj instanceof List<?> presets) || presets.isEmpty()) {
            return "presets must be a non-empty array.";
        }
        if (!isNonEmptyString(payload.get("user_id"))) {
            return "user_id is required.";
        }
        for (Object item : presets) {
            if (!isPresetItem(item)) {
                return "Each preset must include restaurant_name, order_url, menu_items, and app_name.";
            }
        }
        return null;
    }

    public static String validateDeletePresetItemRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        if (!isNonEmptyString(payload.get("restaurant_name"))) {
            return "restaurant_name is required.";
        }
        if (!isNonEmptyString(payload.get("order_url"))) {
            return "order_url is required.";
        }
        return null;
    }

    public static String validateGetPresetsRequest(String userId) {
        if (!isNonEmptyString(userId)) {
            return "user_id is required.";
        }
        return null;
    }

    private void requireUserId(String userId) {
        String validationError = validateGetPresetsRequest(userId);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
    }

    private static RuntimeException mapListError(UserServicePreferencesException ex) {
        if (ex.getStatus() < 500) {
            return ex;
        }
        return new ApiException(
                HttpStatus.BAD_GATEWAY,
                "preferences_backend_error",
                "Unable to load presets: " + ex.getMessage());
    }

    private static RuntimeException mapMutationError(
            UserServicePreferencesException ex, String prefix) {
        if (ex.getStatus() < 500) {
            return ex;
        }
        return new ApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "persistence_error",
                prefix + ": " + ex.getMessage());
    }

    @SuppressWarnings("unchecked")
    private static boolean isPresetItem(Object item) {
        if (!(item instanceof Map<?, ?> map)) {
            return false;
        }
        Object menuItems = map.get("menu_items");
        return isNonEmptyString(map.get("restaurant_name"))
                && isNonEmptyString(map.get("order_url"))
                && menuItems instanceof List<?> list
                && !list.isEmpty()
                && isNonEmptyString(map.get("app_name"));
    }

    private static boolean isNonEmptyString(Object value) {
        return value instanceof String s && !s.trim().isEmpty();
    }
}
