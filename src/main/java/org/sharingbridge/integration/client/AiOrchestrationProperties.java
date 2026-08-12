package org.sharingbridge.integration.client;

/**
 * AI orchestration env settings matching Node {@code aiOrchestrationClient.js}.
 */
public record AiOrchestrationProperties(
        String baseUrl,
        String internalApiKey,
        long suggestVendorsTimeoutMs,
        long instructionPackTimeoutMs,
        int retryMaxAttempts,
        int suggestVendorsRetryMaxAttempts,
        int instructionPackRetryMaxAttempts,
        long retryBaseDelayMs,
        long retryMaxDelayMs) {

    public static AiOrchestrationProperties fromEnvironment() {
        return fromEnvironment(System.getenv());
    }

    public static AiOrchestrationProperties fromEnvironment(java.util.Map<String, String> env) {
        int sharedRetry = clampRetryAttempts(env.get("AI_ORCHESTRATION_RETRY_MAX_ATTEMPTS"), 5);
        return new AiOrchestrationProperties(
                trim(env.get("AI_ORCHESTRATION_BASE_URL")),
                trim(env.get("AI_ORCHESTRATION_INTERNAL_API_KEY")),
                readLong(env.get("AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS"), 15_000L),
                readLong(env.get("AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS"), 60_000L),
                sharedRetry,
                env.containsKey("AI_ORCHESTRATION_SUGGEST_VENDORS_RETRY_MAX_ATTEMPTS")
                                && env.get("AI_ORCHESTRATION_SUGGEST_VENDORS_RETRY_MAX_ATTEMPTS") != null
                                && !env.get("AI_ORCHESTRATION_SUGGEST_VENDORS_RETRY_MAX_ATTEMPTS").isBlank()
                        ? clampRetryAttempts(
                                env.get("AI_ORCHESTRATION_SUGGEST_VENDORS_RETRY_MAX_ATTEMPTS"), sharedRetry)
                        : sharedRetry,
                env.containsKey("AI_ORCHESTRATION_INSTRUCTION_PACK_RETRY_MAX_ATTEMPTS")
                                && env.get("AI_ORCHESTRATION_INSTRUCTION_PACK_RETRY_MAX_ATTEMPTS") != null
                                && !env.get("AI_ORCHESTRATION_INSTRUCTION_PACK_RETRY_MAX_ATTEMPTS").isBlank()
                        ? clampRetryAttempts(
                                env.get("AI_ORCHESTRATION_INSTRUCTION_PACK_RETRY_MAX_ATTEMPTS"), sharedRetry)
                        : sharedRetry,
                readLong(env.get("AI_ORCHESTRATION_RETRY_BASE_DELAY_MS"), 8_000L),
                readLong(env.get("AI_ORCHESTRATION_RETRY_MAX_DELAY_MS"), 45_000L));
    }

    public boolean suggestVendorsAiEnabled() {
        return AiOrchestrationClient.envFlag(System.getenv("AI_SUGGEST_VENDORS_ENABLED"))
                && baseUrl != null
                && !baseUrl.isBlank();
    }

    public boolean instructionPackAiEnabled() {
        return AiOrchestrationClient.envFlag(System.getenv("AI_INSTRUCTION_PACK_ENABLED"))
                && baseUrl != null
                && !baseUrl.isBlank();
    }

    public boolean suggestVendorsAiEnabled(java.util.Map<String, String> env) {
        return AiOrchestrationClient.envFlag(env.get("AI_SUGGEST_VENDORS_ENABLED"))
                && baseUrl != null
                && !baseUrl.isBlank();
    }

    public boolean instructionPackAiEnabled(java.util.Map<String, String> env) {
        return AiOrchestrationClient.envFlag(env.get("AI_INSTRUCTION_PACK_ENABLED"))
                && baseUrl != null
                && !baseUrl.isBlank();
    }

    private static int clampRetryAttempts(String raw, int fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            double n = Double.parseDouble(raw.trim());
            return n >= 1 ? (int) Math.floor(n) : fallback;
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static long readLong(String raw, long fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return (long) Double.parseDouble(raw.trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
