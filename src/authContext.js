/**
 * Minimal auth context resolver for MVP.
 *
 * Real authentication will be issued by sharebridge-user-service. Until then
 * we accept a non-cryptographic placeholder token so the rest of the stack
 * (mobile app, integration-service) can stop hard-coding `demo-user` and
 * instead pass the donor's identity through headers.
 *
 * Resolution order (first match wins):
 *   1. Authorization: Bearer demo.<user_id>
 *   2. X-User-Id: <user_id>
 *
 * Returns null when no context is present. Callers decide whether to
 * fall back to a body/query user_id (for backward compat) or reject the
 * request with 401.
 */

export const DEMO_TOKEN_PREFIX = "demo.";
export const X_USER_ID_HEADER = "x-user-id";

function readBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  return trimmed.slice(7).trim();
}

export function extractUserIdFromHeaders(headers) {
  if (!headers) return null;

  const token = readBearerToken(headers["authorization"]);
  if (token && token.startsWith(DEMO_TOKEN_PREFIX)) {
    const candidate = token.slice(DEMO_TOKEN_PREFIX.length).trim();
    if (candidate.length > 0) {
      return candidate;
    }
  }

  const xUserId = headers[X_USER_ID_HEADER];
  if (typeof xUserId === "string" && xUserId.trim().length > 0) {
    return xUserId.trim();
  }

  return null;
}

/**
 * Reconcile a header-derived user_id with one supplied in the request
 * body/query. Returns { userId, error } where error (when set) is an
 * object suitable for sendJson (status + body).
 */
export function resolveAuthenticatedUserId({ headerUserId, supplied }) {
  if (!headerUserId && !supplied) {
    return {
      userId: null,
      error: {
        status: 401,
        body: {
          code: "missing_auth_context",
          message:
            "user_id could not be resolved from auth context or request payload."
        }
      }
    };
  }

  if (headerUserId && supplied && headerUserId !== supplied) {
    return {
      userId: null,
      error: {
        status: 403,
        body: {
          code: "user_id_mismatch",
          message:
            "user_id in payload does not match the authenticated user_id."
        }
      }
    };
  }

  return { userId: headerUserId || supplied, error: null };
}
