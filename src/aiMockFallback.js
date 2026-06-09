/**
 * When false (production default), AI routes do not return mock/stub templates
 * on orchestration failure — callers receive HTTP 503 instead.
 */
export function isAiMockFallbackEnabled(env = process.env) {
  const raw = env.AI_MOCK_FALLBACK_ENABLED;
  if (raw === undefined || raw === "") {
    return false;
  }
  return raw === "true" || raw === "1";
}

export class AiServiceUnavailableError extends Error {
  constructor(message, { code = "ai_unavailable" } = {}) {
    super(message);
    this.name = "AiServiceUnavailableError";
    this.status = 503;
    this.code = code;
  }
}
