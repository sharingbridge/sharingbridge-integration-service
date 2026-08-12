import {
  classifyHttpBody,
  orchestrationRequestTarget
} from "./aiOrchestrationErrors.js";

function envFlag(name) {
  const raw = process.env[name];
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

/** suggest-vendors HTTP timeout. */
export function resolveSuggestVendorsTimeoutMs(env = process.env) {
  return Number(env.AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS || 15000);
}

/** instruction-pack HTTP timeout (Nominatim + Gemini vision + Groq). */
export function resolveInstructionPackTimeoutMs(env = process.env) {
  return Number(env.AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS || 60000);
}

function clampRetryAttempts(value, fallback = 5) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/** Shared retry budget when Render edge or upstream returns 429/502/503. */
export function resolveOrchestrationRetryMaxAttempts(env = process.env) {
  if (env.AI_ORCHESTRATION_RETRY_MAX_ATTEMPTS) {
    return clampRetryAttempts(env.AI_ORCHESTRATION_RETRY_MAX_ATTEMPTS);
  }
  return 5;
}

/** instruction-pack retries when Render edge or upstream returns 429/502/503. */
export function resolveInstructionPackRetryMaxAttempts(env = process.env) {
  if (env.AI_ORCHESTRATION_INSTRUCTION_PACK_RETRY_MAX_ATTEMPTS) {
    return clampRetryAttempts(env.AI_ORCHESTRATION_INSTRUCTION_PACK_RETRY_MAX_ATTEMPTS);
  }
  return resolveOrchestrationRetryMaxAttempts(env);
}

/** suggest-vendors retries (same Render throttle path as instruction-pack). */
export function resolveSuggestVendorsRetryMaxAttempts(env = process.env) {
  if (env.AI_ORCHESTRATION_SUGGEST_VENDORS_RETRY_MAX_ATTEMPTS) {
    return clampRetryAttempts(env.AI_ORCHESTRATION_SUGGEST_VENDORS_RETRY_MAX_ATTEMPTS);
  }
  return resolveOrchestrationRetryMaxAttempts(env);
}

export function resolveOrchestrationRetryDelayMs(
  attempt,
  env = process.env,
  { baseDelayMs = 8000, maxDelayMs = 45000 } = {}
) {
  const base = Number(env.AI_ORCHESTRATION_RETRY_BASE_DELAY_MS || baseDelayMs);
  const max = Number(env.AI_ORCHESTRATION_RETRY_MAX_DELAY_MS || maxDelayMs);
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? attempt : 1;
  const delay = Math.min(max, base * safeAttempt);
  const jitter = Math.floor(Math.random() * 1000);
  return delay + jitter;
}

export function isAiOrchestrationConfigured() {
  return Boolean(process.env.AI_ORCHESTRATION_BASE_URL?.trim());
}

export function isSuggestVendorsAiEnabled() {
  return envFlag("AI_SUGGEST_VENDORS_ENABLED") && isAiOrchestrationConfigured();
}

export function isInstructionPackAiEnabled() {
  return envFlag("AI_INSTRUCTION_PACK_ENABLED") && isAiOrchestrationConfigured();
}

export class AiOrchestrationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AiOrchestrationError";
    this.status = options.status;
    this.code = options.code;
    this.phase = options.phase;
    this.path = options.path;
    this.host = options.host;
    this.contentType = options.contentType;
    this.responseKind = options.responseKind;
    this.bodyPreview = options.bodyPreview;
    this.upstreamDetail = options.upstreamDetail;
    this.hint = options.hint;
    this.attempts = options.attempts;
    this.maxAttempts = options.maxAttempts;
  }
}

/**
 * Minimal HTTP client for sharingbridge-ai-orchestration internal routes.
 */
export class AiOrchestrationClient {
  constructor({
    baseUrl = process.env.AI_ORCHESTRATION_BASE_URL,
    internalApiKey = process.env.AI_ORCHESTRATION_INTERNAL_API_KEY,
    timeoutMs = resolveSuggestVendorsTimeoutMs(),
    instructionPackTimeoutMs = resolveInstructionPackTimeoutMs(),
    fetchImpl = globalThis.fetch
  } = {}) {
    this.baseUrl = (baseUrl || "").replace(/\/$/, "");
    this.internalApiKey = internalApiKey || "";
    this.timeoutMs = timeoutMs;
    this.instructionPackTimeoutMs = instructionPackTimeoutMs;
    this.fetchImpl = fetchImpl;
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  static isRetryableOrchestrationError(error) {
    if (!(error instanceof AiOrchestrationError)) {
      return false;
    }
    if (error.code === "timeout" || error.code === "network_error") {
      return true;
    }
    if (
      error.code === "rate_limited" ||
      error.code === "non_json_response" ||
      error.code === "invalid_json"
    ) {
      return error.status === 429 || error.status === 502 || error.status === 503;
    }
    return [429, 502, 503].includes(error.status);
  }

  async postInternal(
    path,
    body,
    {
      timeoutMs,
      maxAttempts = resolveOrchestrationRetryMaxAttempts(),
      retryDelayMs = (attempt) => resolveOrchestrationRetryDelayMs(attempt),
      log = console
    } = {}
  ) {
    if (!this.baseUrl) {
      throw new AiOrchestrationError("AI_ORCHESTRATION_BASE_URL is not set.");
    }

    const { logWarn } = await import("./serviceLog.js");
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this._postInternalOnce(path, body, { timeoutMs });
      } catch (error) {
        lastError = error;
        const retryable = AiOrchestrationClient.isRetryableOrchestrationError(error);
        if (!retryable || attempt >= maxAttempts) {
          if (error instanceof AiOrchestrationError) {
            error.attempts = attempt;
            error.maxAttempts = maxAttempts;
            error.path = error.path || path;
          }
          throw error;
        }
        const waitMs = retryDelayMs(attempt);
        const phase = error instanceof AiOrchestrationError ? error.phase : "";
        const bodyKind =
          error instanceof AiOrchestrationError ? error.responseKind : "";
        logWarn(
          log,
          `[orchestration] ${path} retry ${attempt}/${maxAttempts} after ` +
            `HTTP ${error.status ?? "?"} code=${error.code ?? "unknown"}` +
            (phase ? ` phase=${phase}` : "") +
            (bodyKind ? ` body_kind=${bodyKind}` : "") +
            ` wait_ms=${waitMs}`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    throw lastError;
  }

  async _postInternalOnce(path, body, { timeoutMs } = {}) {
    const effectiveTimeoutMs = timeoutMs ?? this.timeoutMs;
    const { host } = orchestrationRequestTarget(this.baseUrl, path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    const headers = { "content-type": "application/json" };
    if (this.internalApiKey) {
      headers["x-internal-api-key"] = this.internalApiKey;
    }

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new AiOrchestrationError(
          "integration HTTP client timed out waiting for ai-orchestration",
          {
            code: "timeout",
            phase: "integration_http_timeout",
            path,
            host,
            hint: `timeout_ms=${effectiveTimeoutMs}`
          }
        );
      }
      throw new AiOrchestrationError(
        `integration HTTP client could not reach ai-orchestration: ${
          error?.message || error
        }`,
        {
          code: "network_error",
          phase: "integration_http_network",
          path,
          host
        }
      );
    } finally {
      clearTimeout(timer);
    }

    const contentType =
      typeof response.headers?.get === "function"
        ? response.headers.get("content-type") || ""
        : "";
    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      const preview = text.trim().slice(0, 120).replace(/\s+/g, " ");
      const { kind, hint } = classifyHttpBody(text);
      const code =
        response.status === 429 ? "rate_limited" : "non_json_response";
      throw new AiOrchestrationError(
        `ai-orchestration HTTP ${response.status} returned non-JSON body`,
        {
          status: response.status,
          code,
          phase: "orchestration_http_non_json",
          path,
          host,
          contentType: contentType.trim() || "unknown",
          responseKind: kind,
          bodyPreview: preview || null,
          hint
        }
      );
    }

    if (!response.ok) {
      const upstreamDetail =
        typeof parsed?.detail === "string"
          ? parsed.detail
          : typeof parsed?.message === "string"
            ? parsed.message
            : null;
      const code =
        response.status === 429
          ? "rate_limited"
          : parsed?.code || "upstream_error";
      throw new AiOrchestrationError(
        `ai-orchestration API error HTTP ${response.status}`,
        {
          status: response.status,
          code,
          phase: "orchestration_api",
          path,
          host,
          contentType: contentType.trim() || "application/json",
          responseKind: "json",
          upstreamDetail,
          hint: upstreamDetail || `FastAPI/uvicorn returned HTTP ${response.status}`
        }
      );
    }

    return parsed;
  }

  suggestVendors(payload, { log = console } = {}) {
    return this.postInternal("/internal/v1/llm/suggest-vendors", payload, {
      maxAttempts: resolveSuggestVendorsRetryMaxAttempts(),
      retryDelayMs: (attempt) => resolveOrchestrationRetryDelayMs(attempt),
      log
    });
  }

  instructionPack(payload, { log = console } = {}) {
    return this.postInternal("/internal/v1/llm/instruction-pack", payload, {
      timeoutMs: this.instructionPackTimeoutMs,
      maxAttempts: resolveInstructionPackRetryMaxAttempts(),
      retryDelayMs: (attempt) => resolveOrchestrationRetryDelayMs(attempt),
      log
    });
  }
}
