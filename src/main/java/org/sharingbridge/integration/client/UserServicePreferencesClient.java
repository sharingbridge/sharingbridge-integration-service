package org.sharingbridge.integration.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * HTTP client for user-service donor-presets, matching Node {@code UserServicePreferencesRepository}.
 */
public class UserServicePreferencesClient {

    private final String baseUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public UserServicePreferencesClient(String baseUrl) {
        this(baseUrl, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build(), new ObjectMapper());
    }

    public UserServicePreferencesClient(String baseUrl, HttpClient httpClient, ObjectMapper objectMapper) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException(
                    "UserServicePreferencesClient requires baseUrl (USER_SERVICE_BASE_URL)");
        }
        this.baseUrl = baseUrl.replaceAll("/$", "");
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> listByUser(String userId, String authorization) {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v1/users/" + encode(userId) + "/donor-presets"))
                .timeout(Duration.ofSeconds(30))
                .GET();
        applyAuth(builder, authorization);
        return exchangePresets(builder.build(), "GET");
    }

    public List<Map<String, Object>> upsertForUser(
            String userId, List<Map<String, Object>> presets, String authorization) {
        try {
            byte[] body = objectMapper.writeValueAsBytes(Map.of("presets", presets));
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/v1/users/" + encode(userId) + "/donor-presets"))
                    .timeout(Duration.ofSeconds(30))
                    .header("content-type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(body));
            applyAuth(builder, authorization);
            return exchangePresets(builder.build(), "PUT");
        } catch (UserServicePreferencesException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new UserServicePreferencesException(
                    502, "preferences_backend_error", "Unable to persist presets: " + ex.getMessage());
        }
    }

    public List<Map<String, Object>> clearForUser(String userId, String authorization) {
        return upsertForUser(userId, List.of(), authorization);
    }

    public List<Map<String, Object>> removePresetForUser(
            String userId, String restaurantName, String orderUrl, String authorization) {
        try {
            byte[] body = objectMapper.writeValueAsBytes(Map.of(
                    "restaurant_name", restaurantName == null ? "" : restaurantName.trim(),
                    "order_url", orderUrl == null ? "" : orderUrl.trim()));
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(
                            baseUrl + "/v1/users/" + encode(userId) + "/donor-presets/delete-item"))
                    .timeout(Duration.ofSeconds(30))
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body));
            applyAuth(builder, authorization);
            return exchangePresets(builder.build(), "delete-item");
        } catch (UserServicePreferencesException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new UserServicePreferencesException(
                    500, "persistence_error", "Unable to remove preset: " + ex.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> exchangePresets(HttpRequest request, String operation) {
        try {
            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode payload = readJson(response.body(), response.statusCode());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw toError(response.statusCode(), payload);
            }
            JsonNode presetsNode = payload.get("presets");
            if (presetsNode == null || !presetsNode.isArray()) {
                throw new IllegalStateException(
                        "User-service " + operation + " donor-presets returned invalid payload.");
            }
            List<Map<String, Object>> presets = new ArrayList<>();
            for (JsonNode item : presetsNode) {
                presets.add(objectMapper.convertValue(item, Map.class));
            }
            return presets;
        } catch (UserServicePreferencesException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new UserServicePreferencesException(
                    502, "preferences_backend_error", "Interrupted calling user-service.");
        } catch (Exception ex) {
            throw new UserServicePreferencesException(
                    502,
                    "preferences_backend_error",
                    ex.getMessage() == null ? String.valueOf(ex) : ex.getMessage());
        }
    }

    private JsonNode readJson(String text, int status) throws Exception {
        if (text == null || text.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(text);
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "User-service response was not valid JSON (status " + status + ").", ex);
        }
    }

    private UserServicePreferencesException toError(int status, JsonNode payload) {
        String code = textOr(payload, "code", "preferences_backend_error");
        String message = textOr(
                payload,
                "message",
                "User-service donor-presets request failed (HTTP " + status + ").");
        return new UserServicePreferencesException(status, code, message);
    }

    private static String textOr(JsonNode payload, String field, String fallback) {
        if (payload != null && payload.hasNonNull(field) && payload.get(field).isTextual()) {
            return payload.get(field).asText();
        }
        return fallback;
    }

    private static void applyAuth(HttpRequest.Builder builder, String authorization) {
        if (authorization != null && !authorization.isBlank()) {
            builder.header("authorization", authorization);
        }
    }

    private static String encode(String userId) {
        return java.net.URLEncoder.encode(userId, java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
    }
}
