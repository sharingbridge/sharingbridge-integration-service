export function formatStandardOfferForApi(record) {
  return {
    standard_offer_id: record.id,
    locality_key: record.locality_key,
    menu_label: record.menu_label,
    price_inr:
      record.price_inr == null || record.price_inr === ""
        ? null
        : Number(record.price_inr),
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export function offerBucketKey(localityKey, standardOfferId) {
  const locality = String(localityKey ?? "").trim() || "unknown";
  const offerId = String(standardOfferId ?? "").trim() || "legacy";
  return `${locality}::${offerId}`;
}

export function parseOfferBucketKey(bucketKey) {
  const [localityKey, standardOfferId] = String(bucketKey).split("::");
  return {
    locality_key: localityKey || "unknown",
    standard_offer_id: standardOfferId === "legacy" ? null : standardOfferId
  };
}
