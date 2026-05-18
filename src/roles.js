export const ROLE_DONOR = "donor";
export const ROLE_COORDINATOR = "coordinator";

export function normalizeRole(role) {
  if (role === ROLE_COORDINATOR) {
    return ROLE_COORDINATOR;
  }
  return ROLE_DONOR;
}
