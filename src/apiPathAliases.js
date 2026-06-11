/**
 * Canonical legacy paths remain `/v1/donor-*` internally; clients may call initiator aliases.
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
export function normalizeIntegrationApiPath(url) {
  if (typeof url !== "string" || !url) {
    return url;
  }
  const qIndex = url.indexOf("?");
  const path = qIndex >= 0 ? url.slice(0, qIndex) : url;
  const query = qIndex >= 0 ? url.slice(qIndex) : "";

  if (path.startsWith("/v1/initiator-setup")) {
    return `/v1/donor-setup${path.slice("/v1/initiator-setup".length)}${query}`;
  }
  if (path === "/v1/instruction-pack") {
    return `/v1/donor-seeker/instruction-pack${query}`;
  }
  if (path === "/v1/order-intents") {
    return `/v1/donor-seeker/order-intents${query}`;
  }
  if (path.startsWith("/v1/order-intents/")) {
    return `/v1/donor-seeker/order-intents${path.slice("/v1/order-intents".length)}${query}`;
  }
  return url;
}
