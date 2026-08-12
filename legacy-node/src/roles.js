export const ROLE_INITIATOR = "initiator";
/** @deprecated JWT/DB legacy alias — treated as initiator */
export const ROLE_DONOR = "donor";
export const ROLE_COORDINATOR = "coordinator";

export function isInitiatorRole(role) {
  return role === ROLE_INITIATOR || role === ROLE_DONOR;
}

export function normalizeRole(role) {
  if (role === ROLE_COORDINATOR) {
    return ROLE_COORDINATOR;
  }
  if (isInitiatorRole(role)) {
    return ROLE_INITIATOR;
  }
  return ROLE_INITIATOR;
}
