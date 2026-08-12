/** Thrown when AI orchestration is unavailable or disabled (HTTP 503). */
export class AiServiceUnavailableError extends Error {
  constructor(message, { code = "ai_unavailable" } = {}) {
    super(message);
    this.name = "AiServiceUnavailableError";
    this.status = 503;
    this.code = code;
  }
}
