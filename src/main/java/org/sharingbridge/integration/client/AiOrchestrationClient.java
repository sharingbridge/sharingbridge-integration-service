package org.sharingbridge.integration.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.IntUnaryOperator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sharingbridge.integration.service.AiBridgeStatus;

/**
 * Minimal HTTP client for ai-orchestration internal routes, matching Node {@code AiOrchestrationClient}.
 */
public class AiOrchestrationClient {

    private static final Logger log = LoggerFactory.getLogger(AiOrchestrationClient.class);

    private final String baseUrl;
    private final String internalApiKey;
    private final long timeoutMs;
    private final long instructionPackTimeoutMs;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final int suggestVendorsRetryMaxAttempts;
    private final int instructionPackRetryMaxAttempts;
    private final IntUnaryOperator retryDelayMs;

    public AiOrchestrationClient(AiOrchestrationProperties properties) {
        this(
                properties,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build(),
                new ObjectMapper(),
                attempt -> resolveOrchestrationRetryDelayMs(attempt, properties));
    }

    public AiOrchestrationClient(
            AiOrchestrationProperties properties,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            IntUnaryOperator retryDelayMs) {
        this.baseUrl = trimTrailingSlash(properties.baseUrl());
        this.internalApiKey = properties.internalApiKey() == null ? "" : properties.internalApiKey();
        this.timeoutMs = properties.suggestVendorsTimeoutMs();
        this.instructionPackTimeoutMs = properties.instructionPackTimeoutMs();
        this.suggestVendorsRetryMaxAttempts = properties.suggestVendorsRetryMaxAttempts();
        this.instructionPackRetryMaxAttempts = properties.instructionPackRetryMaxAttempts();
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.retryDelayMs = retryDelayMs;
    }

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank();
    }

    public Map<String, Object> suggestVendors(Map<String, Object> payload) {
        return postInternal(
                "/internal/v1/llm/suggest-vendors",
                payload,
                timeoutMs,
                suggestVendorsRetryMaxAttempts);
    }

    public Map<String, Object> instructionPack(Map<String, Object> payload) {
        return postInternal(
                "/internal/v1/llm/instruction-pack",
                payload,
                instructionPackTimeoutMs,
                instructionPackRetryMaxAttempts);
    }

    static boolean isRetryableOrchestrationError(Throwable error) {
        if (!(error instanceof AiOrchestrationException ax)) {
            return false;
        }
        if ("timeout".equals(ax.getCode()) || "network_error".equals(ax.getCode())) {
            return true;
        }
        if ("rate_limited".equals(ax.getCode())
                || "non_json_response".equals(ax.getCode())
                || "invalid_json".equals(ax.getCode())) {
            return ax.getStatus() != null
                    && (ax.getStatus() == 429 || ax.getStatus() == 502 || ax.getStatus() == 503);
        }
        return ax.getStatus() != null
                && (ax.getStatus() == 429 || ax.getStatus() == 502 || ax.getStatus() == 503);
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> postInternal(
            String path, Map<String, Object> body, long timeoutMs, int maxAttempts) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw AiOrchestrationException.builder()
                    .build("AI_ORCHESTRATION_BASE_URL is not set.");
        }
        AiOrchestrationException lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return postInternalOnce(path, body, timeoutMs);
            } catch (AiOrchestrationException error) {
                lastError = error;
                boolean retryable = isRetryableOrchestrationError(error);
                if (!retryable || attempt >= maxAttempts) {
                    error.setAttempts(attempt);
                    error.setMaxAttempts(maxAttempts);
                    if (error.getPath() == null || error.getPath().isBlank()) {
                        error.setPath(path);
                    }
                    throw error;
                }
                int waitMs = retryDelayMs.applyAsInt(attempt);
                log.warn(
                        "[orchestration] {} retry {}/{} after HTTP {} code={}{}{} wait_ms={}",
                        path,
                        attempt,
                        maxAttempts,
                        error.getStatus() == null ? "?" : error.getStatus(),
                        error.getCode() == null ? "unknown" : error.getCode(),
                        error.getPhase() == null || error.getPhase().isBlank()
                                ? ""
                                : " phase=" + error.getPhase(),
                        error.getResponseKind() == null || error.getResponseKind().isBlank()
                                ? ""
                                : " body_kind=" + error.getResponseKind(),
                        waitMs);
                sleep(waitMs);
            }
        }
        throw lastError;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postInternalOnce(
            String path, Map<String, Object> body, long effectiveTimeoutMs) {
        String host = AiBridgeStatus.hostFromUrl(baseUrl);
        try {
            byte[] json = objectMapper.writeValueAsBytes(body);
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + path))
                    .timeout(Duration.ofMillis(Math.max(1, effectiveTimeoutMs)))
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(json));
            if (!internalApiKey.isBlank()) {
                builder.header("x-internal-api-key", internalApiKey);
            }
            HttpResponse<String> response;
            try {
                response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            } catch (java.net.http.HttpTimeoutException ex) {
                throw AiOrchestrationException.builder()
                        .code("timeout")
                        .phase("integration_http_timeout")
                        .path(path)
                        .host(host)
                        .hint("timeout_ms=" + effectiveTimeoutMs)
                        .build("integration HTTP client timed out waiting for ai-orchestration");
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw AiOrchestrationException.builder()
                        .code("network_error")
                        .phase("integration_http_network")
                        .path(path)
                        .host(host)
                        .build("integration HTTP client could not reach ai-orchestration: interrupted");
            } catch (Exception ex) {
                throw AiOrchestrationException.builder()
                        .code("network_error")
                        .phase("integration_http_network")
                        .path(path)
                        .host(host)
                        .build("integration HTTP client could not reach ai-orchestration: "
                                + (ex.getMessage() == null ? ex : ex.getMessage()));
            }

            String contentType = response.headers()
                    .firstValue("content-type")
                    .orElse("")
                    .trim();
            String text = response.body() == null ? "" : response.body();
            JsonNode parsed;
            try {
                parsed = text.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(text);
            } catch (Exception ex) {
                String preview = text.trim().replaceAll("\\s+", " ");
                if (preview.length() > 120) {
                    preview = preview.substring(0, 120);
                }
                var classified = AiOrchestrationErrors.classifyHttpBody(text);
                String code = response.statusCode() == 429 ? "rate_limited" : "non_json_response";
                throw AiOrchestrationException.builder()
                        .status(response.statusCode())
                        .code(code)
                        .phase("orchestration_http_non_json")
                        .path(path)
                        .host(host)
                        .contentType(contentType.isEmpty() ? "unknown" : contentType)
                        .responseKind(classified.kind())
                        .bodyPreview(preview.isEmpty() ? null : preview)
                        .hint(classified.hint())
                        .build("ai-orchestration HTTP " + response.statusCode() + " returned non-JSON body");
            }

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String upstreamDetail = null;
                if (parsed.hasNonNull("detail") && parsed.get("detail").isTextual()) {
                    upstreamDetail = parsed.get("detail").asText();
                } else if (parsed.hasNonNull("message") && parsed.get("message").isTextual()) {
                    upstreamDetail = parsed.get("message").asText();
                }
                String code = response.statusCode() == 429
                        ? "rate_limited"
                        : (parsed.hasNonNull("code") && parsed.get("code").isTextual()
                                ? parsed.get("code").asText()
                                : "upstream_error");
                throw AiOrchestrationException.builder()
                        .status(response.statusCode())
                        .code(code)
                        .phase("orchestration_api")
                        .path(path)
                        .host(host)
                        .contentType(contentType.isEmpty() ? "application/json" : contentType)
                        .responseKind("json")
                        .upstreamDetail(upstreamDetail)
                        .hint(upstreamDetail != null
                                ? upstreamDetail
                                : "FastAPI/uvicorn returned HTTP " + response.statusCode())
                        .build("ai-orchestration API error HTTP " + response.statusCode());
            }

            return objectMapper.convertValue(parsed, Map.class);
        } catch (AiOrchestrationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw AiOrchestrationException.builder()
                    .code("network_error")
                    .phase("integration_http_network")
                    .path(path)
                    .host(host)
                    .build("integration HTTP client could not reach ai-orchestration: "
                            + (ex.getMessage() == null ? ex : ex.getMessage()));
        }
    }

    public static int resolveOrchestrationRetryDelayMs(int attempt, AiOrchestrationProperties properties) {
        long base = properties.retryBaseDelayMs();
        long max = properties.retryMaxDelayMs();
        int safeAttempt = attempt > 0 ? attempt : 1;
        long delay = Math.min(max, base * safeAttempt);
        int jitter = ThreadLocalRandom.current().nextInt(1000);
        return (int) (delay + jitter);
    }

    private static void sleep(int waitMs) {
        try {
            Thread.sleep(Math.max(0, waitMs));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

    private static String trimTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    public static boolean envFlag(String raw) {
        if (raw == null || raw.isBlank()) {
            return false;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "1", "true", "yes", "on" -> true;
            default -> false;
        };
    }
}
