function normalizeCity(manualArea) {
  if (!isNonEmptyString(manualArea)) {
    return "chennai";
  }
  const token = manualArea.trim().split(",")[0].split(/\s+/)[0].toLowerCase();
  return token || "chennai";
}

export function buildVendorSearchUrl(appName, restaurantName, city = "chennai") {
  const query = encodeURIComponent((restaurantName || "").trim());
  const app = (appName || "").trim().toLowerCase();
  const citySlug = (city || "chennai").trim().toLowerCase();
  if (app === "zomato") {
    return `https://www.zomato.com/${citySlug}/restaurants?q=${query}`;
  }
  if (app === "swiggy") {
    return `https://www.swiggy.com/search?query=${query}`;
  }
  return `https://www.google.com/search?q=${query}+${encodeURIComponent(appName)}+food+delivery`;
}

function enrichSuggestionUrls(suggestions, payload) {
  const city = normalizeCity(payload?.manual_area);
  return suggestions.map((item) => ({
    ...item,
    order_url: buildVendorSearchUrl(item.app_name, item.restaurant_name, city)
  }));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function inferAppName(queryText) {
  const q = queryText.toLowerCase();
  if (q.includes("swiggy")) {
    return "Swiggy";
  }
  return "Zomato";
}

/**
 * Echo the user's query as one search row — no invented restaurants.
 * Hardcoded mock catalogs belong in unit-test fixtures only.
 */
export function buildPassthroughSuggestVendorsResponse(payload = {}) {
  const query =
    typeof payload.query_text === "string" ? payload.query_text.trim() : "";
  if (!query) {
    return {
      suggestions: [],
      generated_at: new Date().toISOString(),
      source: "passthrough"
    };
  }
  const appName = inferAppName(query);
  return {
    suggestions: enrichSuggestionUrls(
      [
        {
          restaurant_name: query,
          menu_items: [query],
          app_name: appName,
          confidence: 1,
          notes: "Your search text — no AI enrichment"
        }
      ],
      payload
    ),
    generated_at: new Date().toISOString(),
    source: "passthrough"
  };
}

/** @deprecated Use buildPassthroughSuggestVendorsResponse — name kept for older tests. */
export function buildSuggestVendorsResponse(payload = {}) {
  return buildPassthroughSuggestVendorsResponse(payload);
}

export function validateSuggestVendorsRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }

  if (!isNonEmptyString(payload.query_text)) {
    return "query_text is required.";
  }

  if (!isNonEmptyString(payload.location_precision)) {
    return "location_precision is required.";
  }

  return null;
}

export async function resolveSuggestVendorsResponse(
  payload,
  { aiClient, log = console } = {}
) {
  const { isSuggestVendorsAiEnabled } = await import("./aiOrchestrationClient.js");
  const { explainMockSuggestVendorsReason } = await import(
    "./aiBridgeStatus.js"
  );
  const { isLiveAiSource, logWarn } = await import("./serviceLog.js");
  const { AiServiceUnavailableError } = await import("./aiServiceUnavailable.js");

  if (isSuggestVendorsAiEnabled() && aiClient?.isConfigured()) {
    try {
      const upstream = await aiClient.suggestVendors(payload, { log });
      const source = upstream.source || "orchestration";
      if (!isLiveAiSource(source)) {
        logWarn(
          log,
          `[suggest-vendors] orchestration returned non-live source=${source} (expected live AI or passthrough of user query)`
        );
      }
      return {
        suggestions: upstream.suggestions ?? [],
        generated_at: upstream.generated_at || new Date().toISOString(),
        source
      };
    } catch (error) {
      const { formatOrchestrationFailure, orchestrationFailureHints } =
        await import("./aiOrchestrationErrors.js");
      const detail =
        formatOrchestrationFailure(error, {
          routeLabel: "suggest-vendors",
          path: "/internal/v1/llm/suggest-vendors"
        }) || error?.message || String(error);
      const hint = orchestrationFailureHints(error);
      logWarn(log, `${detail}${hint}`);
      throw new AiServiceUnavailableError(
        `Suggest vendors ${detail}${hint}`,
        { code: "orchestration_unavailable" }
      );
    }
  }

  throw new AiServiceUnavailableError(
    `Suggest vendors unavailable: ${explainMockSuggestVendorsReason()}`,
    { code: "ai_disabled" }
  );
}

function isPresetItem(item) {
  return (
    item &&
    typeof item === "object" &&
    isNonEmptyString(item.restaurant_name) &&
    isNonEmptyString(item.order_url) &&
    Array.isArray(item.menu_items) &&
    item.menu_items.length > 0 &&
    isNonEmptyString(item.app_name)
  );
}

export function validateSavePresetsRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }

  if (!Array.isArray(payload.presets) || payload.presets.length === 0) {
    return "presets must be a non-empty array.";
  }
  if (!isNonEmptyString(payload.user_id)) {
    return "user_id is required.";
  }

  if (!payload.presets.every((item) => isPresetItem(item))) {
    return "Each preset must include restaurant_name, order_url, menu_items, and app_name.";
  }

  return null;
}

export function validateGetPresetsRequest(userId) {
  if (!isNonEmptyString(userId)) {
    return "user_id is required.";
  }
  return null;
}

export function validateDeletePresetItemRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }
  if (!isNonEmptyString(payload.restaurant_name)) {
    return "restaurant_name is required.";
  }
  if (!isNonEmptyString(payload.order_url)) {
    return "order_url is required.";
  }
  return null;
}
