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
    generated_at: new Date().toISOString()
  };
}
