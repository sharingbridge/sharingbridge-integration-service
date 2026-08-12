const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const GEO_CACHE_MAX = 128;
/** @type {Map<string, { localityKey: string | null, formattedAddress: string } | null>} */
const reverseCache = new Map();

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

/**
 * @param {unknown} data
 * @returns {string}
 */
export function formatDisplayAddressFromNominatim(data) {
  if (!data || typeof data !== "object") {
    return "";
  }
  const displayName =
    typeof data.display_name === "string" ? data.display_name.trim() : "";
  if (displayName) {
    return displayName;
  }
  const address = data.address;
  if (!address || typeof address !== "object") {
    return "";
  }
  const parts = [
    address.house_number,
    address.road ?? address.pedestrian ?? address.footway,
    address.suburb ?? address.neighbourhood ?? address.quarter,
    address.city ?? address.town ?? address.village,
    address.postcode,
    address.state,
    address.country
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function remember(cacheId, value) {
  if (reverseCache.size >= GEO_CACHE_MAX) {
    reverseCache.clear();
  }
  reverseCache.set(cacheId, value);
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ localityKey: string | null, formattedAddress: string } | null>}
 */
async function fetchNominatimReverse(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const key = cacheKey(lat, lng);
  if (reverseCache.has(key)) {
    return reverseCache.get(key) ?? null;
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
    const result = {
      localityKey: formatLocalityKeyFromNominatim(data),
      formattedAddress: formatDisplayAddressFromNominatim(data)
    };
    remember(key, result);
    return result;
  } catch {
    remember(key, null);
    return null;
  }
}

/**
 * Resolve GPS to hierarchical locality_key via Nominatim reverse geocode.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string | null>}
 */
export async function derivePostalLocalityKey(lat, lng) {
  const result = await fetchNominatimReverse(lat, lng);
  return result?.localityKey ?? null;
}

/**
 * Reverse geocode coordinates for mobile map picker (address + postal bucket).
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ location_lat: number, location_lng: number, locality_key: string, formatted_address: string } | null>}
 */
export async function reverseGeocodeLocation(lat, lng) {
  const result = await fetchNominatimReverse(lat, lng);
  if (!result) {
    return null;
  }
  return {
    location_lat: lat,
    location_lng: lng,
    locality_key: result.localityKey ?? "",
    formatted_address: result.formattedAddress
  };
}
