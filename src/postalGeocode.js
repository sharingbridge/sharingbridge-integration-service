const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const GEO_CACHE_MAX = 128;
/** @type {Map<string, string | null>} */
const geoCache = new Map();

/** Fallback when Nominatim has state but no postcode. */
const INDIAN_STATE_CODES = {
  "tamil nadu": "TN",
  "tamilnadu": "TN"
};

/**
 * @param {unknown} data
 * @returns {string | null}
 */
export function formatLocalityKeyFromNominatim(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  const address = data.address;
  if (!address || typeof address !== "object") {
    return null;
  }

  const country = String(address.country_code ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return null;
  }

  let region = "";
  const iso =
    address["ISO3166-2-lvl4"] ??
    address["ISO3166-2-lvl3"] ??
    address["ISO3166-2"];
  if (typeof iso === "string" && iso.includes("-")) {
    const part = iso.split("-")[1]?.trim().toUpperCase();
    if (part) {
      region = part;
    }
  }
  if (!region && typeof address.state === "string") {
    const normalized = address.state.trim().toLowerCase();
    region = INDIAN_STATE_CODES[normalized] ?? "";
  }

  const postal = String(address.postcode ?? "")
    .replace(/\s+/g, "")
    .trim();

  if (postal && region) {
    return `${country}:${region}:${postal}`;
  }
  if (region) {
    return `${country}:${region}`;
  }
  return country;
}

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function remember(cacheId, value) {
  if (geoCache.size >= GEO_CACHE_MAX) {
    geoCache.clear();
  }
  geoCache.set(cacheId, value);
}

/**
 * Resolve GPS to hierarchical locality_key via Nominatim reverse geocode.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string | null>}
 */
export async function derivePostalLocalityKey(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const key = cacheKey(lat, lng);
  if (geoCache.has(key)) {
    return geoCache.get(key) ?? null;
  }

  const userAgent =
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    "SharingBridge-Integration-Service/1.0";

  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      remember(key, null);
      return null;
    }
    const data = await response.json();
    const localityKey = formatLocalityKeyFromNominatim(data);
    remember(key, localityKey);
    return localityKey;
  } catch {
    remember(key, null);
    return null;
  }
}
