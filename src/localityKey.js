/**
 * Hierarchical locality keys: {ISO3166-1}:{ISO3166-2}:{postal}
 * Examples: IN:TN:600115, IN:TN, IN
 */

const LOCALITY_KEY_PART = /^[A-Z0-9]{2,10}$/;

export function normalizeLocalityKey(key) {
  const trimmed = String(key ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed
    .split(":")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .join(":");
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isValidLocalityKey(key) {
  const normalized = normalizeLocalityKey(key);
  if (!normalized) {
    return false;
  }
  const parts = normalized.split(":");
  if (parts.length < 1 || parts.length > 3) {
    return false;
  }
  return parts.every((part) => LOCALITY_KEY_PART.test(part));
}

/**
 * Most-specific first: IN:TN:600115 → IN:TN → IN
 * @param {string} key
 * @returns {string[]}
 */
export function localityKeyChain(key) {
  const trimmed = String(key ?? "").trim();
  if (!trimmed) {
    return [];
  }
  const parts = trimmed.split(":");
  const chain = [];
  for (let depth = parts.length; depth >= 1; depth -= 1) {
    chain.push(parts.slice(0, depth).join(":"));
  }
  return chain;
}

/**
 * True when `offerKey` applies to demand at `userKey` (equal or ancestor prefix).
 * @param {string} offerKey
 * @param {string} userKey
 */
export function offerAppliesToLocality(offerKey, userKey) {
  const offer = String(offerKey ?? "").trim();
  const user = String(userKey ?? "").trim();
  if (!offer || !user) {
    return false;
  }
  if (offer === user) {
    return true;
  }
  return user.startsWith(`${offer}:`);
}

/**
 * True when a record's locality key equals the filter or is a descendant
 * (deeper segment chain). Examples with record IN:TN:600097:
 *   filter IN        → match
 *   filter IN:TN     → match
 *   filter IN:TN:600097 → match
 *   filter IN:KA     → no match
 * @param {string} recordKey
 * @param {string} filterKey
 */
export function recordMatchesLocalityFilter(recordKey, filterKey) {
  const record = normalizeLocalityKey(recordKey);
  const filter = normalizeLocalityKey(filterKey);
  if (!record || !filter) {
    return false;
  }
  if (record === filter) {
    return true;
  }
  return record.startsWith(`${filter}:`);
}

/**
 * Pick catalog rows for a resolved user locality; most-specific menu line wins per offer id.
 * @param {Array<{ id?: string, standard_offer_id?: string, locality_key: string, menu_label?: string }>} offers
 * @param {string} userLocalityKey
 */
export function resolveStandardOffersForLocality(offers, userLocalityKey) {
  const userKey = String(userLocalityKey ?? "").trim();
  if (!userKey || !Array.isArray(offers)) {
    return [];
  }
  const chain = new Set(localityKeyChain(userKey));
  const applicable = offers.filter((offer) =>
    chain.has(String(offer.locality_key ?? "").trim())
  );
  const byOfferId = new Map();
  for (const offer of applicable) {
    const offerId = String(offer.id ?? offer.standard_offer_id ?? "").trim();
    if (!offerId) {
      continue;
    }
    const depth = String(offer.locality_key ?? "").split(":").length;
    const existing = byOfferId.get(offerId);
    if (!existing || depth > existing.depth) {
      byOfferId.set(offerId, { offer, depth });
    }
  }
  return [...byOfferId.values()]
    .map((entry) => entry.offer)
    .sort((a, b) =>
      String(a.menu_label ?? "").localeCompare(String(b.menu_label ?? ""))
    );
}
