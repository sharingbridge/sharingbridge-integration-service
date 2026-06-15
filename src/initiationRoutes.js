export const INITIATION_ROUTES = {
  DIRECT_ORDER: "direct_order",
  ECO_KITCHEN_SELF_PAY: "eco_kitchen_self_pay",
  ECO_KITCHEN_PLEDGE: "eco_kitchen_pledge"
};

const ROUTE_SET = new Set(Object.values(INITIATION_ROUTES));

export function isInitiationRoute(value) {
  return typeof value === "string" && ROUTE_SET.has(value);
}

export function resolveSeekerDemandRoute(payload) {
  const raw =
    typeof payload?.initiation_route === "string"
      ? payload.initiation_route.trim()
      : "";
  if (raw && isInitiationRoute(raw)) {
    return raw;
  }
  return INITIATION_ROUTES.ECO_KITCHEN_PLEDGE;
}
