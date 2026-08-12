package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sharingbridge.integration.client.AiOrchestrationClient;
import org.sharingbridge.integration.client.AiOrchestrationErrors;
import org.sharingbridge.integration.client.AiOrchestrationProperties;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SuggestVendorsService {

    private static final Logger log = LoggerFactory.getLogger(SuggestVendorsService.class);

    private final AiOrchestrationClient aiClient;
    private final AiOrchestrationProperties properties;

    public SuggestVendorsService(
            AiOrchestrationClient aiClient, AiOrchestrationProperties properties) {
        this.aiClient = aiClient;
        this.properties = properties;
    }

    public Map<String, Object> suggest(Map<String, Object> payload) {
        String validationError = validateSuggestVendorsRequest(payload);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        return resolveSuggestVendorsResponse(payload);
    }

    public Map<String, Object> resolveSuggestVendorsResponse(Map<String, Object> payload) {
        if (properties.suggestVendorsAiEnabled() && aiClient.isConfigured()) {
            try {
                Map<String, Object> upstream = aiClient.suggestVendors(payload);
                String source = stringOr(upstream.get("source"), "orchestration");
                if (!AiBridgeStatus.isLiveAiSource(source)) {
                    log.warn(
                            "[suggest-vendors] orchestration returned non-live source={} (expected live AI or passthrough of user query)",
                            source);
                }
                Map<String, Object> body = new LinkedHashMap<>();
                Object suggestions = upstream.get("suggestions");
                body.put("suggestions", suggestions instanceof List<?> ? suggestions : List.of());
                body.put(
                        "generated_at",
                        stringOr(upstream.get("generated_at"), Instant.now().toString()));
                body.put("source", source);
                return body;
            } catch (Exception error) {
                String detail = AiOrchestrationErrors.formatOrchestrationFailure(
                        error, "suggest-vendors", "/internal/v1/llm/suggest-vendors");
                if (detail == null || detail.isBlank()) {
                    detail = error.getMessage() == null ? String.valueOf(error) : error.getMessage();
                }
                String hint = AiOrchestrationErrors.orchestrationFailureHints(error);
                log.warn("{}{}", detail, hint);
                throw new AiServiceUnavailableException(
                        "Suggest vendors " + detail + hint, "orchestration_unavailable");
            }
        }
        throw new AiServiceUnavailableException(
                "Suggest vendors unavailable: " + AiBridgeStatus.explainMockSuggestVendorsReason(),
                "ai_disabled");
    }

    public static String validateSuggestVendorsRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        if (!isNonEmptyString(payload.get("query_text"))) {
            return "query_text is required.";
        }
        if (!isNonEmptyString(payload.get("location_precision"))) {
            return "location_precision is required.";
        }
        return null;
    }

    private static boolean isNonEmptyString(Object value) {
        return value instanceof String s && !s.trim().isEmpty();
    }

    private static String stringOr(Object value, String fallback) {
        if (value instanceof String s && !s.isBlank()) {
            return s;
        }
        return fallback;
    }
}
