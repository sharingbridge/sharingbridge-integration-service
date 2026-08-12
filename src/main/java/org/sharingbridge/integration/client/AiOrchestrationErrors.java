package org.sharingbridge.integration.client;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.sharingbridge.integration.service.AiBridgeStatus;

/** Helpers matching Node {@code aiOrchestrationErrors.js}. */
public final class AiOrchestrationErrors {

    private static final Pattern PLAIN_RATE_LIMIT = Pattern.compile("^too many requests\\.?$", Pattern.CASE_INSENSITIVE);

    private AiOrchestrationErrors() {}

    public static BodyClassification classifyHttpBody(String text) {
        String trimmed = text == null ? "" : text.trim();
        if (trimmed.isEmpty()) {
            return new BodyClassification("empty", "empty response body");
        }
        if (PLAIN_RATE_LIMIT.matcher(trimmed).matches()) {
            return new BodyClassification(
                    "plain_rate_limit",
                    "plain-text rate limit (proxy/CDN — FastAPI would return JSON {\"detail\":...})");
        }
        String lower = trimmed.substring(0, Math.min(32, trimmed.length())).toLowerCase(Locale.ROOT);
        if (lower.startsWith("<!doctype") || lower.startsWith("<html")) {
            return new BodyClassification(
                    "html", "HTML error page (proxy/CDN — not ai-orchestration JSON API)");
        }
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return new BodyClassification(
                    "json_parse_failed", "body looked like JSON but failed to parse");
        }
        return new BodyClassification("plain_text", "plain-text response (not application/json)");
    }

    public static String formatOrchestrationFailure(
            Throwable error, String routeLabel, String pathFallback) {
        if (!(error instanceof AiOrchestrationException ax)) {
            return error == null ? "null" : (error.getMessage() == null ? String.valueOf(error) : error.getMessage());
        }
        String route = routeLabel == null || routeLabel.isBlank() ? "orchestration" : routeLabel;
        String path = ax.getPath() != null && !ax.getPath().isBlank() ? ax.getPath() : pathFallback;
        StringBuilder segments = new StringBuilder("[").append(route).append("]");
        append(segments, "phase", ax.getPhase());
        if (path != null && !path.isBlank()) {
            segments.append(" path=").append(path);
        }
        append(segments, "host", ax.getHost());
        if (ax.getStatus() != null) {
            segments.append(" status=").append(ax.getStatus());
        }
        append(segments, "code", ax.getCode());
        if (ax.getAttempts() != null && ax.getMaxAttempts() != null) {
            segments.append(" attempts=").append(ax.getAttempts()).append('/').append(ax.getMaxAttempts());
        }
        append(segments, "content-type", ax.getContentType());
        append(segments, "body_kind", ax.getResponseKind());
        if (ax.getBodyPreview() != null) {
            segments.append(" body=").append(jsonString(ax.getBodyPreview()));
        }
        if (ax.getUpstreamDetail() != null) {
            segments.append(" detail=").append(jsonString(ax.getUpstreamDetail()));
        }
        if (ax.getHint() != null && !ax.getHint().isBlank()) {
            segments.append(' ').append(ax.getHint());
        } else if (ax.getMessage() != null && !ax.getMessage().isBlank()) {
            segments.append(' ').append(ax.getMessage());
        }
        return segments.toString();
    }

    public static String orchestrationFailureHints(Throwable error) {
        if (!(error instanceof AiOrchestrationException ax)) {
            return "";
        }
        if ("orchestration_http_non_json".equals(ax.getPhase())) {
            if ("plain_rate_limit".equals(ax.getResponseKind())) {
                return " (HTTP/proxy plain-text 429 — not FastAPI JSON; if ai-orchestration logs "
                        + "lack a matching route start line, the request never reached the app)";
            }
            if ("html".equals(ax.getResponseKind())) {
                return " (HTML error page from proxy/CDN — request may not reach ai-orchestration)";
            }
            if ("json_parse_failed".equals(ax.getResponseKind())) {
                return " (malformed JSON from ai-orchestration HTTP response)";
            }
            return " (non-JSON HTTP body — integration parse step failed)";
        }
        if ("orchestration_api".equals(ax.getPhase()) && "rate_limited".equals(ax.getCode())) {
            return " (FastAPI JSON rate limit — check Groq/Gemini quota in ai-orchestration logs)";
        }
        if ("integration_http_timeout".equals(ax.getPhase())) {
            return "";
        }
        if ("rate_limited".equals(ax.getCode())) {
            return " (rate limited after integration retries)";
        }
        return "";
    }

    public static Map.Entry<String, String> orchestrationRequestTarget(String baseUrl, String path) {
        return Map.entry(
                AiBridgeStatus.hostFromUrl(baseUrl) == null ? "" : AiBridgeStatus.hostFromUrl(baseUrl),
                path == null ? "" : path);
    }

    private static void append(StringBuilder sb, String key, String value) {
        if (value != null && !value.isBlank()) {
            sb.append(' ').append(key).append('=').append(value);
        }
    }

    private static String jsonString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    public record BodyClassification(String kind, String hint) {}
}
