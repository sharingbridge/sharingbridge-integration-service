// MVP catalog — order_url filled at response time via vendor search deep links.
const MOCK_SUGGESTIONS = [
  {
    restaurant_name: "A2B",
    menu_items: ["Mini Meals", "Curd Rice"],
    app_name: "Zomato",
    confidence: 0.92,
    notes: "Opens vendor search — pick the correct outlet in the app"
  },
  {
    restaurant_name: "Saravana Bhavan",
    menu_items: ["Idli Sambar", "Pongal"],
    app_name: "Swiggy",
    confidence: 0.88,
    notes: "Opens vendor search — pick the correct outlet in the app"
  },
  {
    restaurant_name: "Sangeetha Veg",
    menu_items: ["Lemon Rice Combo", "Bisibele Bath"],
    app_name: "Zomato",
    confidence: 0.84,
    notes: "Opens vendor search — pick the correct outlet in the app"
  }
];

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

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
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

export function buildSuggestVendorsResponse(payload = {}) {
  return {
    suggestions: enrichSuggestionUrls(MOCK_SUGGESTIONS.slice(0, 5), payload),
    generated_at: new Date().toISOString(),
    source: "mock"
  };
}

export async function resolveSuggestVendorsResponse(payload, { aiClient } = {}) {
  const { isSuggestVendorsAiEnabled } = await import("./aiOrchestrationClient.js");
  if (isSuggestVendorsAiEnabled() && aiClient?.isConfigured()) {
    try {
      const upstream = await aiClient.suggestVendors(payload);
      return {
        suggestions: upstream.suggestions ?? [],
        generated_at: upstream.generated_at || new Date().toISOString(),
        source: upstream.source || "orchestration"
      };
    } catch {
      const fallback = buildSuggestVendorsResponse(payload);
      return { ...fallback, source: "mock_fallback" };
    }
  }
  return buildSuggestVendorsResponse(payload);
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
