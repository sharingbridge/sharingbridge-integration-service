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
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "AiOrchestrationError";
    this.status = status;
    this.code = code;
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
    if (error.code === "rate_limited" || error.code === "invalid_json") {
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
          throw error;
        }
        const waitMs = retryDelayMs(attempt);
        logWarn(
          log,
          `[orchestration] ${path} retry ${attempt}/${maxAttempts} after ` +
            `HTTP ${error.status ?? "?"} code=${error.code ?? "unknown"} ` +
            `wait_ms=${waitMs}`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    throw lastError;
  }

  async _postInternalOnce(path, body, { timeoutMs } = {}) {
    const effectiveTimeoutMs = timeoutMs ?? this.timeoutMs;
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
        throw new AiOrchestrationError("AI orchestration request timed out.", {
          code: "timeout"
        });
      }
      throw new AiOrchestrationError(
        `AI orchestration request failed: ${error?.message || error}`,
        { code: "network_error" }
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      const preview = text.trim().slice(0, 120).replace(/\s+/g, " ");
      const detail = preview ? ` Body preview: ${preview}` : "";
      const code =
        response.status === 429 ? "rate_limited" : "invalid_json";
      throw new AiOrchestrationError(
        `AI orchestration returned invalid JSON (HTTP ${response.status}).${detail}`,
        { status: response.status, code }
      );
    }

    if (!response.ok) {
      const code =
        response.status === 429
          ? "rate_limited"
          : parsed?.code || "upstream_error";
      throw new AiOrchestrationError(
        parsed?.detail || parsed?.message || `HTTP ${response.status}`,
        { status: response.status, code }
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
