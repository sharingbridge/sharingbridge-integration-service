package org.sharingbridge.integration.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sharingbridge.integration.client.AiOrchestrationClient;
import org.sharingbridge.integration.client.AiOrchestrationErrors;
import org.sharingbridge.integration.client.AiOrchestrationException;
import org.sharingbridge.integration.client.AiOrchestrationProperties;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class InstructionPackService {

    private static final Logger log = LoggerFactory.getLogger(InstructionPackService.class);

    private final AiOrchestrationClient aiClient;
    private final AiOrchestrationProperties properties;

    public InstructionPackService(
            AiOrchestrationClient aiClient, AiOrchestrationProperties properties) {
        this.aiClient = aiClient;
        this.properties = properties;
    }

    public Map<String, Object> build(Map<String, Object> payload, String userId) {
        String validationError = validateInstructionPackRequest(payload);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        Map<String, Object> resolved = resolveInstructionPackResponse(payload, userId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("user_id", userId);
        body.putAll(resolved);
        return body;
    }

    public Map<String, Object> resolveInstructionPackResponse(
            Map<String, Object> payload, String userId) {
        if (properties.instructionPackAiEnabled() && aiClient.isConfigured()) {
            try {
                Map<String, Object> upstream =
                        aiClient.instructionPack(mapInstructionPackRequest(payload, userId));
                String source = stringOr(upstream.get("source"), "orchestration");
                if (!AiBridgeStatus.isLiveAiSource(source)) {
                    log.warn(
                            "[instruction-pack] orchestration returned non-live source={} (check AI_LLM_MODE=live and API keys on ai-orchestration)",
                            source);
                } else if (Boolean.TRUE.equals(payload.get("has_reference_photo"))
                        && "groq".equals(source)
                        && isBlank(upstream.get("image_description"))
                        && isBlank(upstream.get("seeker_appearance_hints"))) {
                    log.warn(
                            "[instruction-pack] reference photo present but vision fields empty "
                                    + "(check GEMINI_API_KEY on ai-orchestration and Render logs for "
                                    + "[instruction-pack-live] gemini vision)");
                }
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("pack_id", upstream.get("pack_id"));
                body.put("delivery_instructions", upstream.get("delivery_instructions"));
                body.put("generated_at", upstream.get("generated_at"));
                body.put("source", source);
                body.put("location_description", upstream.getOrDefault("location_description", null));
                body.put("image_description", upstream.getOrDefault("image_description", null));
                body.put(
                        "seeker_appearance_hints",
                        upstream.getOrDefault("seeker_appearance_hints", null));
                body.put(
                        "seeker_handover_hints",
                        upstream.getOrDefault("seeker_handover_hints", null));
                return body;
            } catch (Exception error) {
                String detail = AiOrchestrationErrors.formatOrchestrationFailure(
                        error, "instruction-pack", "/internal/v1/llm/instruction-pack");
                if (detail == null || detail.isBlank()) {
                    detail = error.getMessage() == null ? String.valueOf(error) : error.getMessage();
                }
                String timeoutHint = "";
                if (error instanceof AiOrchestrationException ax && "timeout".equals(ax.getCode())) {
                    timeoutHint =
                            " (instruction-pack uses Nominatim + Gemini vision + Groq; increase AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS)";
                }
                String hint = AiOrchestrationErrors.orchestrationFailureHints(error);
                log.warn("{}{}{}", detail, timeoutHint, hint);
                throw new AiServiceUnavailableException(
                        "Instruction pack " + detail + timeoutHint + hint,
                        "orchestration_unavailable");
            }
        }
        throw new AiServiceUnavailableException(
                "Instruction pack unavailable: " + AiBridgeStatus.explainInstructionPackMockReason(),
                "ai_disabled");
    }

    public static Map<String, Object> mapInstructionPackRequest(
            Map<String, Object> payload, String userId) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("user_id", userId);
        mapped.put(
                "verbal_handover_notes",
                payload.get("verbal_handover_notes") == null
                        ? ""
                        : payload.get("verbal_handover_notes"));
        mapped.put("has_reference_photo", Boolean.TRUE.equals(payload.get("has_reference_photo")));
        mapped.put(
                "reference_photo_artifact_id",
                payload.getOrDefault("reference_photo_artifact_id", null));
        mapped.put(
                "reference_photo_view_url", payload.getOrDefault("reference_photo_view_url", null));
        mapped.put(
                "reference_photo_thumbnail_url",
                payload.getOrDefault("reference_photo_thumbnail_url", null));
        mapped.put("lat", payload.getOrDefault("lat", null));
        mapped.put("lng", payload.getOrDefault("lng", null));
        mapped.put("location_label", payload.getOrDefault("location_label", null));
        Object presets = payload.get("presets");
        mapped.put("presets", presets instanceof List<?> list ? list : List.of());
        mapped.put("donor_display_name", payload.getOrDefault("donor_display_name", null));
        mapped.put("seeker_display_name", payload.getOrDefault("seeker_display_name", null));
        return mapped;
    }

    public static String validateInstructionPackRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        if (payload.containsKey("presets") && payload.get("presets") != null) {
            if (!(payload.get("presets") instanceof List<?> presets)) {
                return "presets must be an array when provided.";
            }
            for (Object item : presets) {
                if (!isPresetItem(item)) {
                    return "Each preset must include restaurant_name, menu_items, and app_name.";
                }
            }
        }
        if (payload.containsKey("verbal_handover_notes")
                && payload.get("verbal_handover_notes") != null
                && !(payload.get("verbal_handover_notes") instanceof String)) {
            return "verbal_handover_notes must be a string when provided.";
        }
        if (payload.containsKey("has_reference_photo")
                && payload.get("has_reference_photo") != null
                && !(payload.get("has_reference_photo") instanceof Boolean)) {
            return "has_reference_photo must be a boolean when provided.";
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private static boolean isPresetItem(Object item) {
        if (!(item instanceof Map<?, ?> map)) {
            return false;
        }
        return isNonEmptyString(map.get("restaurant_name"))
                && map.get("menu_items") instanceof List<?>
                && isNonEmptyString(map.get("app_name"));
    }

    private static boolean isNonEmptyString(Object value) {
        return value instanceof String s && !s.trim().isEmpty();
    }

    private static boolean isBlank(Object value) {
        return value == null || (value instanceof String s && s.isBlank());
    }

    private static String stringOr(Object value, String fallback) {
        if (value instanceof String s && !s.isBlank()) {
            return s;
        }
        return fallback;
    }
}
