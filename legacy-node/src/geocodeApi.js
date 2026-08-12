/**
 * @param {Awaited<ReturnType<import("./postalGeocode.js").reverseGeocodeLocation>>} result
 */
export function formatReverseGeocodeForApi(result) {
  if (!result) {
    return null;
  }
  return {
    location_lat: result.location_lat,
    location_lng: result.location_lng,
    locality_key: result.locality_key ?? "",
    formatted_address: result.formatted_address ?? ""
  };
}
