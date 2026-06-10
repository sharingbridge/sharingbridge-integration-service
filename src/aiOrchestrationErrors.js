import { hostFromUrl } from "./aiBridgeStatus.js";

/**
 * @param {string} text
 * @returns {{ kind: string, hint: string }}
 */
export function classifyHttpBody(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    return {
      kind: "empty",
      hint: "empty response body"
    };
  }
  if (/^too many requests\.?$/i.test(trimmed)) {
    return {
      kind: "plain_rate_limit",
      hint:
        "plain-text rate limit (proxy/CDN — FastAPI would return JSON {\"detail\":...})"
    };
  }
  const lower = trimmed.slice(0, 32).toLowerCase();
  if (lower.startsWith("<!doctype") || lower.startsWith("<html")) {
    return {
      kind: "html",
      hint: "HTML error page (proxy/CDN — not ai-orchestration JSON API)"
    };
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return {
      kind: "json_parse_failed",
      hint: "body looked like JSON but failed to parse"
    };
  }
  return {
    kind: "plain_text",
    hint: "plain-text response (not application/json)"
  };
}

/**
 * Single-line failure text for integration logs and API errors.
 *
 * @param {import("./aiOrchestrationClient.js").AiOrchestrationError | Error} error
 * @param {{ routeLabel?: string, path?: string }} [context]
 */
export function formatOrchestrationFailure(error, context = {}) {
  if (!error || typeof error !== "object") {
    return String(error);
  }
  if (error.name !== "AiOrchestrationError") {
    return error.message || String(error);
  }

  const routeLabel = context.routeLabel || "orchestration";
  const path = error.path || context.path || "";
  const segments = [`[${routeLabel}]`];

  if (error.phase) {
    segments.push(`phase=${error.phase}`);
  }
  if (path) {
    segments.push(`path=${path}`);
  }
  if (error.host) {
    segments.push(`host=${error.host}`);
  }
  if (error.status != null) {
    segments.push(`status=${error.status}`);
  }
  if (error.code) {
    segments.push(`code=${error.code}`);
  }
  if (error.attempts != null && error.maxAttempts != null) {
    segments.push(`attempts=${error.attempts}/${error.maxAttempts}`);
  }
  if (error.contentType) {
    segments.push(`content-type=${error.contentType}`);
  }
  if (error.responseKind) {
    segments.push(`body_kind=${error.responseKind}`);
  }
  if (error.bodyPreview) {
    segments.push(`body=${JSON.stringify(error.bodyPreview)}`);
  }
  if (error.upstreamDetail) {
    segments.push(`detail=${JSON.stringify(error.upstreamDetail)}`);
  }
  if (error.hint) {
    segments.push(error.hint);
  } else if (error.message) {
    segments.push(error.message);
  }

  return segments.join(" ");
}

/**
 * Route-specific hint appended after the structured failure line.
 *
 * @param {import("./aiOrchestrationClient.js").AiOrchestrationError | Error} error
 */
export function orchestrationFailureHints(error) {
  if (!error || error.name !== "AiOrchestrationError") {
    return "";
  }

  if (error.phase === "orchestration_http_non_json") {
    if (error.responseKind === "plain_rate_limit") {
      return (
        " (HTTP/proxy plain-text 429 — not FastAPI JSON; if ai-orchestration logs " +
        "lack a matching route start line, the request never reached the app)"
      );
    }
    if (error.responseKind === "html") {
      return " (HTML error page from proxy/CDN — request may not reach ai-orchestration)";
    }
    if (error.responseKind === "json_parse_failed") {
      return " (malformed JSON from ai-orchestration HTTP response)";
    }
    return " (non-JSON HTTP body — integration parse step failed)";
  }

  if (error.phase === "orchestration_api" && error.code === "rate_limited") {
    return " (FastAPI JSON rate limit — check Groq/Gemini quota in ai-orchestration logs)";
  }

  if (error.phase === "integration_http_timeout") {
    return "";
  }

  if (error.code === "rate_limited") {
    return " (rate limited after integration retries)";
  }

  return "";
}

/**
 * @param {string} baseUrl
 * @param {string} path
 */
export function orchestrationRequestTarget(baseUrl, path) {
  return {
    host: hostFromUrl(baseUrl),
    path: typeof path === "string" ? path : ""
  };
}
