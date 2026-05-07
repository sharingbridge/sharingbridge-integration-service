import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
  buildSuggestVendorsResponse,
  validateGetPresetsRequest,
  validateSavePresetsRequest,
  validateSuggestVendorsRequest
} from "./suggestVendors.js";
import { PreferencesStore } from "./preferencesStore.js";
import {
  LocalPreferencesGateway,
  UserServicePreferencesGateway
} from "./preferencesGateway.js";
import {
  extractUserIdFromHeaders,
  resolveAuthenticatedUserId
} from "./authContext.js";

const DEFAULT_PORT = Number(process.env.PORT || 8080);

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Build an http.Server wired up against the given preferences gateway.
 * Tests inject a LocalPreferencesGateway with a temp-directory store; the
 * bin entrypoint at the bottom of this file selects the gateway based on
 * the PREFERENCES_BACKEND env var so swapping to user-service is one flip.
 */
export function createIntegrationServer({ preferencesGateway }) {
  if (!preferencesGateway) {
    throw new Error("createIntegrationServer requires preferencesGateway");
  }
  return createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { ok: true, service: "integration-service" });
    }

    if (
      req.method === "POST" &&
      req.url === "/v1/donor-setup/suggest-vendors"
    ) {
      let rawBody = "";

      req.on("data", (chunk) => {
        rawBody += chunk;
      });

      req.on("end", () => {
        let payload;
        try {
          payload = JSON.parse(rawBody || "{}");
        } catch {
          return sendJson(res, 400, {
            code: "invalid_json",
            message: "Request body must be valid JSON."
          });
        }

        const validationError = validateSuggestVendorsRequest(payload);
        if (validationError) {
          return sendJson(res, 400, {
            code: "invalid_request",
            message: validationError
          });
        }

        return sendJson(res, 200, buildSuggestVendorsResponse());
      });

      return;
    }

    if (
      req.method === "GET" &&
      req.url.startsWith("/v1/donor-setup/preferences")
    ) {
      const requestUrl = new URL(req.url, "http://localhost");
      const queryUserId = requestUrl.searchParams.get("user_id");
      const headerUserId = extractUserIdFromHeaders(req.headers);
      const { userId, error: authError } = resolveAuthenticatedUserId({
        headerUserId,
        supplied: queryUserId
      });
      if (authError) {
        return sendJson(res, authError.status, authError.body);
      }
      const validationError = validateGetPresetsRequest(userId);
      if (validationError) {
        return sendJson(res, 400, {
          code: "invalid_request",
          message: validationError
        });
      }
      preferencesGateway
        .listByUser(userId)
        .then((presets) =>
          sendJson(res, 200, { user_id: userId, presets })
        )
        .catch((error) =>
          sendJson(res, 502, {
            code: "preferences_backend_error",
            message: `Unable to load presets: ${error.message || error}`
          })
        );
      return;
    }

    if (req.method === "POST" && req.url === "/v1/donor-setup/preferences") {
      let rawBody = "";

      req.on("data", (chunk) => {
        rawBody += chunk;
      });

      req.on("end", () => {
        let payload;
        try {
          payload = JSON.parse(rawBody || "{}");
        } catch {
          return sendJson(res, 400, {
            code: "invalid_json",
            message: "Request body must be valid JSON."
          });
        }

        const headerUserId = extractUserIdFromHeaders(req.headers);
        const { userId: authedUserId, error: authError } =
          resolveAuthenticatedUserId({
            headerUserId,
            supplied: payload.user_id
          });
        if (authError) {
          return sendJson(res, authError.status, authError.body);
        }
        // Use auth-resolved user_id from this point on so validation and
        // persistence cannot drift from the authenticated identity.
        payload.user_id = authedUserId;

        const validationError = validateSavePresetsRequest(payload);
        if (validationError) {
          return sendJson(res, 400, {
            code: "invalid_request",
            message: validationError
          });
        }

        const now = new Date().toISOString();
        const created = payload.presets.map((preset, index) => ({
          ...preset,
          id: `${authedUserId}-preset-${Date.now()}-${index + 1}`,
          saved_at: now
        }));

        preferencesGateway
          .upsertForUser(authedUserId, created)
          .then((updated) =>
            sendJson(res, 200, {
              user_id: authedUserId,
              saved_count: created.length,
              total_count: updated.length,
              preset_ids: created.map((item) => item.id),
              saved_at: now
            })
          )
          .catch((error) =>
            sendJson(res, 500, {
              code: "persistence_error",
              message: `Unable to persist presets: ${error.message || error}`
            })
          );
        return;
      });

      return;
    }

    sendJson(res, 404, {
      code: "not_found",
      message: "Route not found."
    });
  });
}

function buildDefaultPreferencesGateway() {
  const backend = (process.env.PREFERENCES_BACKEND || "local").toLowerCase();
  if (backend === "user_service") {
    return new UserServicePreferencesGateway({
      baseUrl: process.env.USER_SERVICE_BASE_URL
    });
  }
  if (backend !== "local") {
    throw new Error(
      `Unknown PREFERENCES_BACKEND='${backend}'. Expected 'local' or 'user_service'.`
    );
  }
  return new LocalPreferencesGateway(new PreferencesStore());
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const preferencesGateway = buildDefaultPreferencesGateway();
  const server = createIntegrationServer({ preferencesGateway });
  preferencesGateway.init().then(() => {
    server.listen(DEFAULT_PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Integration service listening on ${DEFAULT_PORT}`);
    });
  });
}
