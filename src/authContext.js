import { verifyAuthToken } from "./tokenService.js";
import { normalizeRole } from "./roles.js";

function readBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  return trimmed.slice(7).trim();
}

export function extractAuthFromHeaders(headers) {
  if (!headers) return null;

  const token = readBearerToken(headers["authorization"]);
  if (token) {
    try {
      const payload = verifyAuthToken(token);
      return {
        userId: payload.sub,
        role: normalizeRole(payload.role)
      };
    } catch {
      return null;
    }
  }
  return null;
}

export function extractUserIdFromHeaders(headers) {
  return extractAuthFromHeaders(headers)?.userId ?? null;
}

export function requireDonorRole(auth) {
  if (!auth) {
    return {
      error: {
        status: 401,
        body: {
          code: "missing_auth_context",
          message: "A valid Bearer token is required."
        }
      }
    };
  }
  if (auth.role !== "donor") {
    return {
      error: {
        status: 403,
        body: {
          code: "forbidden",
          message: "This action requires a donor account."
        }
      }
    };
  }
  return { error: null };
}

export function requireCoordinatorRole(auth) {
  if (!auth) {
    return {
      error: {
        status: 401,
        body: {
          code: "missing_auth_context",
          message: "A valid Bearer token is required."
        }
      }
    };
  }
  if (auth.role !== "coordinator") {
    return {
      error: {
        status: 403,
        body: {
          code: "forbidden",
          message: "This action requires a coordinator account."
        }
      }
    };
  }
  return { error: null };
}

/**
 * Reconcile a header-derived user_id with one supplied in the request
 * body/query. Returns { userId, error } where error (when set) is an
 * object suitable for sendJson (status + body).
 */
export function resolveAuthenticatedUserId({ headerUserId, supplied }) {
  if (!headerUserId) {
    return {
      userId: null,
      error: {
        status: 401,
        body: {
          code: "missing_auth_context",
          message: "A valid Bearer token is required."
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

  return { userId: headerUserId, error: null };
}
