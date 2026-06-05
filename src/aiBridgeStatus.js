function envFlag(name, env = process.env) {
  const raw = env[name];
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export function hostFromUrl(rawUrl) {
  const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed).host;
  } catch {
    return "invalid-url";
  }
}

/**
 * Non-secret AI bridge snapshot for /health and startup logs.
 */
export function buildAiBridgeStatus(env = process.env) {
  const baseUrl = env.AI_ORCHESTRATION_BASE_URL?.trim() || "";
  const suggestFlag = envFlag("AI_SUGGEST_VENDORS_ENABLED", env);
  const instructionFlag = envFlag("AI_INSTRUCTION_PACK_ENABLED", env);
  const baseUrlSet = Boolean(baseUrl);

  return {
    orchestration_base_url_set: baseUrlSet,
    orchestration_host: hostFromUrl(baseUrl),
    suggest_vendors_flag: suggestFlag,
    instruction_pack_flag: instructionFlag,
    suggest_vendors_path_active: baseUrlSet && suggestFlag,
    instruction_pack_path_active: baseUrlSet && instructionFlag,
    internal_api_key_set: Boolean(env.AI_ORCHESTRATION_INTERNAL_API_KEY?.trim()),
    orchestration_timeout_ms: Number(env.AI_ORCHESTRATION_TIMEOUT_MS || 15000),
    instruction_pack_timeout_ms: Number(
      env.AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS ||
        env.AI_ORCHESTRATION_TIMEOUT_MS ||
        60000
    )
  };
}

export function buildStartupConfig(env = process.env) {
  return {
    service: "integration-service",
    user_service_host: hostFromUrl(env.USER_SERVICE_BASE_URL),
    database_url_set: Boolean(env.DATABASE_URL?.trim()),
    web_cors_origins_set: Boolean(env.WEB_CORS_ORIGINS?.trim()),
    ai: buildAiBridgeStatus(env)
  };
}

export function explainMockSuggestVendorsReason(env = process.env) {
  const baseUrl = env.AI_ORCHESTRATION_BASE_URL?.trim() || "";
  if (!baseUrl) {
    return "AI_ORCHESTRATION_BASE_URL is unset";
  }
  if (!envFlag("AI_SUGGEST_VENDORS_ENABLED", env)) {
    return "AI_SUGGEST_VENDORS_ENABLED is not true";
  }
  return "AI orchestration client not configured";
}

export function explainInstructionPackMockReason(env = process.env) {
  const baseUrl = env.AI_ORCHESTRATION_BASE_URL?.trim() || "";
  if (!baseUrl) {
    return "AI_ORCHESTRATION_BASE_URL is unset";
  }
  if (!envFlag("AI_INSTRUCTION_PACK_ENABLED", env)) {
    return "AI_INSTRUCTION_PACK_ENABLED is not true";
  }
  return "AI orchestration client not configured";
}
