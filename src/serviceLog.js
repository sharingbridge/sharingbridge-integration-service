const LEVEL_RANK = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const LIVE_AI_SOURCES = new Set([
  "groq",
  "groq+gemini",
  "gemini",
  "orchestration"
]);

export function resolveLogLevel(env = process.env) {
  const raw = (env.LOG_LEVEL || "warn").trim().toLowerCase();
  return Object.hasOwn(LEVEL_RANK, raw) ? raw : "warn";
}

export function shouldLog(level, env = process.env) {
  const configured = resolveLogLevel(env);
  return LEVEL_RANK[level] <= LEVEL_RANK[configured];
}

export function logAt(level, log, line, env = process.env) {
  if (!shouldLog(level, env)) {
    return;
  }
  const fn = log?.[level];
  if (typeof fn === "function") {
    fn(line);
    return;
  }
  if (level === "error" && typeof log?.error === "function") {
    log.error(line);
    return;
  }
  if (typeof log?.warn === "function") {
    log.warn(line);
  }
}

export function logWarn(log, line, env = process.env) {
  logAt("warn", log, line, env);
}

export function logError(log, line, env = process.env) {
  logAt("error", log, line, env);
}

export function isLiveAiSource(source) {
  if (typeof source !== "string") {
    return false;
  }
  return LIVE_AI_SOURCES.has(source.trim().toLowerCase());
}

/**
 * Startup: warn on issues; full non-secret config dump at info+.
 */
export function logStartupFromIssues(
  config,
  issues,
  log = console,
  env = process.env
) {
  if (issues.length > 0) {
    logWarn(
      log,
      `[startup] config issues: ${JSON.stringify(issues)}`,
      env
    );
  }

  if (shouldLog("info", env)) {
    logAt("info", log, `[startup] config ${JSON.stringify(config)}`, env);
  }
}

export function logListenMessage(log, line, env = process.env) {
  logAt("info", log, line, env);
}

/**
 * Integration-service AI bridge startup checks.
 */
export function logStartupDiagnostics(config, log = console, env = process.env) {
  const issues = [];
  const ai = config?.ai || {};

  if (ai.suggest_vendors_flag && !ai.suggest_vendors_path_active) {
    issues.push(
      "AI_SUGGEST_VENDORS_ENABLED=true but orchestration URL is missing"
    );
  }
  if (ai.instruction_pack_flag && !ai.instruction_pack_path_active) {
    issues.push(
      "AI_INSTRUCTION_PACK_ENABLED=true but orchestration URL is missing"
    );
  }
  if (ai.suggest_vendors_path_active && !ai.internal_api_key_set) {
    issues.push(
      "orchestration URL set but AI_ORCHESTRATION_INTERNAL_API_KEY is empty (401 if orchestration requires a key)"
    );
  }

  logStartupFromIssues(config, issues, log, env);
}
