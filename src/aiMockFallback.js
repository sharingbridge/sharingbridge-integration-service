/**
 * When false (production default), AI routes fail with HTTP 503 if orchestration
 * is unavailable — no invented vendor catalogs.
 * When true (local only), suggest-vendors may echo query_text (passthrough).
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
