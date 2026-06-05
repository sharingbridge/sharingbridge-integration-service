const DEFAULT_TIMEOUT_MS = Number(process.env.AI_ORCHESTRATION_TIMEOUT_MS || 15000);
const DEFAULT_INSTRUCTION_PACK_TIMEOUT_MS = Number(
  process.env.AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS ||
    process.env.AI_ORCHESTRATION_TIMEOUT_MS ||
    60000
);

export function resolveInstructionPackTimeoutMs(env = process.env) {
  return Number(
    env.AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS ||
      env.AI_ORCHESTRATION_TIMEOUT_MS ||
      60000
  );
}

function envFlag(name) {
  const raw = process.env[name];
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
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
    timeoutMs = DEFAULT_TIMEOUT_MS,
    instructionPackTimeoutMs = DEFAULT_INSTRUCTION_PACK_TIMEOUT_MS,
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

  async postInternal(path, body, { timeoutMs } = {}) {
    if (!this.baseUrl) {
      throw new AiOrchestrationError("AI_ORCHESTRATION_BASE_URL is not set.");
    }

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
      throw new AiOrchestrationError("AI orchestration returned invalid JSON.", {
        status: response.status,
        code: "invalid_json"
      });
    }

    if (!response.ok) {
      throw new AiOrchestrationError(
        parsed?.detail || parsed?.message || `HTTP ${response.status}`,
        { status: response.status, code: parsed?.code || "upstream_error" }
      );
    }

    return parsed;
  }

  suggestVendors(payload) {
    return this.postInternal("/internal/v1/llm/suggest-vendors", payload);
  }

  instructionPack(payload) {
    return this.postInternal("/internal/v1/llm/instruction-pack", payload, {
      timeoutMs: this.instructionPackTimeoutMs
    });
  }
}
