// MVP mock: response is fixed (does not vary with query_text). Real search/AI would
// replace this. Clients should still show all menu_items — see mobile Donor Setup list.
const MOCK_SUGGESTIONS = [
  {
    restaurant_name: "A2B",
    menu_items: ["Mini Meals", "Curd Rice"],
    order_url: "https://www.zomato.com/chennai/a2b/order",
    app_name: "Zomato",
    confidence: 0.92,
    notes: "Popular around current location"
  },
  {
    restaurant_name: "Saravana Bhavan",
    menu_items: ["Idli Sambar", "Pongal"],
    order_url: "https://www.swiggy.com/city/chennai/saravana-bhavan/order",
    app_name: "Swiggy",
    confidence: 0.88,
    notes: "Strong vegetarian breakfast options"
  },
  {
    restaurant_name: "Sangeetha Veg",
    menu_items: ["Lemon Rice Combo", "Bisibele Bath"],
    order_url: "https://www.zomato.com/chennai/sangeetha/order",
    app_name: "Zomato",
    confidence: 0.84,
    notes: "Good daytime meal options"
  }
];

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

  const hasGps = isNumber(payload.lat) && isNumber(payload.lng);
  const hasManual = isNonEmptyString(payload.manual_area);

  if (!hasGps && !hasManual) {
    return "Either lat/lng or manual_area is required.";
  }

  return null;
}

export function buildSuggestVendorsResponse() {
  return {
    suggestions: MOCK_SUGGESTIONS.slice(0, 5),
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
      const fallback = buildSuggestVendorsResponse();
      return { ...fallback, source: "mock_fallback" };
    }
  }
  return buildSuggestVendorsResponse();
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
