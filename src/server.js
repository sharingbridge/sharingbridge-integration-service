import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { AiOrchestrationClient } from "./aiOrchestrationClient.js";
import {
  resolveInstructionPackResponse,
  validateInstructionPackRequest
} from "./instructionPack.js";
import {
  resolveSuggestVendorsResponse,
  validateDeletePresetItemRequest,
  validateGetPresetsRequest,
  validateSavePresetsRequest,
  validateSuggestVendorsRequest
} from "./suggestVendors.js";
import { PreferencesStore } from "./preferencesStore.js";
import {
  LocalPreferencesRepository,
  UserServicePreferencesError,
  UserServicePreferencesRepository
} from "./preferencesRepository.js";
import {
  extractUserIdFromHeaders,
  resolveAuthenticatedUserId
} from "./authContext.js";

const DEFAULT_PORT = Number(process.env.PORT || 8080);

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function pickAuthHeaders(headers) {
  const out = {};
  if (typeof headers?.authorization === "string") {
    out.authorization = headers.authorization;
  }
  return out;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(rawBody || "{}"));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Build an http.Server wired up against the given preferences repository.
 * Tests inject a LocalPreferencesRepository with a temp-directory store;
 * the bin entrypoint at the bottom of this file selects the repository
 * based on the PREFERENCES_BACKEND env var so swapping to user-service is
 * one config flip.
 */
export function createIntegrationServer({
  preferencesRepository,
  aiOrchestrationClient = new AiOrchestrationClient()
}) {
  if (!preferencesRepository) {
    throw new Error(
      "createIntegrationServer requires preferencesRepository"
    );
  }
  return createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { ok: true, service: "integration-service" });
    }

    if (
      req.method === "POST" &&
      req.url === "/v1/donor-setup/suggest-vendors"
    ) {
      readJsonBody(req)
        .then(async (payload) => {
          const validationError = validateSuggestVendorsRequest(payload);
          if (validationError) {
            return sendJson(res, 400, {
              code: "invalid_request",
              message: validationError
            });
          }

          const body = await resolveSuggestVendorsResponse(payload, {
            aiClient: aiOrchestrationClient
          });
          return sendJson(res, 200, body);
        })
        .catch((error) => {
          if (error?.message === "invalid_json") {
            return sendJson(res, 400, {
              code: "invalid_json",
              message: "Request body must be valid JSON."
            });
          }
          return sendJson(res, 500, {
            code: "internal_error",
            message: error?.message || "Unexpected error."
          });
        });

      return;
    }

    if (
      req.method === "POST" &&
      req.url === "/v1/donor-seeker/instruction-pack"
    ) {
      readJsonBody(req)
        .then(async (payload) => {
          const headerUserId = extractUserIdFromHeaders(req.headers);
          const suppliedUserId =
            typeof payload.user_id === "string" ? payload.user_id.trim() : "";
          let userId = headerUserId || suppliedUserId || null;
          if (
            headerUserId &&
            suppliedUserId &&
            headerUserId !== suppliedUserId
          ) {
            return sendJson(res, 403, {
              code: "user_id_mismatch",
              message:
                "user_id in payload does not match the authenticated user_id."
            });
          }

          const validationError = validateInstructionPackRequest(payload);
          if (validationError) {
            return sendJson(res, 400, {
              code: "invalid_request",
              message: validationError
            });
          }

          const body = await resolveInstructionPackResponse(payload, {
            aiClient: aiOrchestrationClient,
            userId
          });
          return sendJson(res, 200, { user_id: userId, ...body });
        })
        .catch((error) => {
          if (error?.message === "invalid_json") {
            return sendJson(res, 400, {
              code: "invalid_json",
              message: "Request body must be valid JSON."
            });
          }
          return sendJson(res, 500, {
            code: "internal_error",
            message: error?.message || "Unexpected error."
          });
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
      preferencesRepository
        .listByUser(userId, { authHeaders: pickAuthHeaders(req.headers) })
        .then((presets) =>
          sendJson(res, 200, { user_id: userId, presets })
        )
        .catch((error) => {
          if (error instanceof UserServicePreferencesError && error.status < 500) {
            return sendJson(res, error.status, {
              code: error.code,
              message: error.message
            });
          }
          return sendJson(res, 502, {
            code: "preferences_backend_error",
            message: `Unable to load presets: ${error.message || error}`
          });
        });
      return;
    }

    if (
      req.method === "POST" &&
      req.url === "/v1/donor-setup/preferences/delete-item"
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

        const headerUserId = extractUserIdFromHeaders(req.headers);
        const { userId: authedUserId, error: authError } =
          resolveAuthenticatedUserId({
            headerUserId,
            supplied: payload.user_id
          });
        if (authError) {
          return sendJson(res, authError.status, authError.body);
        }

        const validationError = validateDeletePresetItemRequest(payload);
        if (validationError) {
          return sendJson(res, 400, {
            code: "invalid_request",
            message: validationError
          });
        }

        const key = {
          restaurant_name: String(payload.restaurant_name).trim(),
          order_url: String(payload.order_url).trim()
        };

        preferencesRepository
          .removePresetForUser(authedUserId, key, {
            authHeaders: pickAuthHeaders(req.headers)
          })
          .then((presets) =>
            sendJson(res, 200, {
              user_id: authedUserId,
              presets
            })
          )
          .catch((error) => {
            if (
              error instanceof UserServicePreferencesError &&
              error.status < 500
            ) {
              return sendJson(res, error.status, {
                code: error.code,
                message: error.message
              });
            }
            return sendJson(res, 500, {
              code: "persistence_error",
              message: `Unable to remove preset: ${error.message || error}`
            });
          });
        return;
      });

      return;
    }

    if (
      req.method === "DELETE" &&
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
      preferencesRepository
        .clearForUser(userId, { authHeaders: pickAuthHeaders(req.headers) })
        .then(() =>
          sendJson(res, 200, {
            user_id: userId,
            presets: [],
            cleared: true
          })
        )
        .catch((error) => {
          if (error instanceof UserServicePreferencesError && error.status < 500) {
            return sendJson(res, error.status, {
              code: error.code,
              message: error.message
            });
          }
          return sendJson(res, 500, {
            code: "persistence_error",
            message: `Unable to clear presets: ${error.message || error}`
          });
        });
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

        preferencesRepository
          .upsertForUser(authedUserId, created, {
            authHeaders: pickAuthHeaders(req.headers)
          })
          .then((updated) =>
            sendJson(res, 200, {
              user_id: authedUserId,
              saved_count: created.length,
              total_count: updated.length,
              preset_ids: created.map((item) => item.id),
              saved_at: now
            })
          )
          .catch((error) => {
            if (
              error instanceof UserServicePreferencesError &&
              error.status < 500
            ) {
              return sendJson(res, error.status, {
                code: error.code,
                message: error.message
              });
            }
            return sendJson(res, 500, {
              code: "persistence_error",
              message: `Unable to persist presets: ${error.message || error}`
            });
          });
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

function buildDefaultPreferencesRepository() {
  const backend = (process.env.PREFERENCES_BACKEND || "local").toLowerCase();
  if (backend === "user_service") {
    return new UserServicePreferencesRepository({
      baseUrl: process.env.USER_SERVICE_BASE_URL
    });
  }
  if (backend !== "local") {
    throw new Error(
      `Unknown PREFERENCES_BACKEND='${backend}'. Expected 'local' or 'user_service'.`
    );
  }
  return new LocalPreferencesRepository(new PreferencesStore());
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const preferencesRepository = buildDefaultPreferencesRepository();
  const server = createIntegrationServer({ preferencesRepository });
  preferencesRepository.init().then(() => {
    server.listen(DEFAULT_PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Integration service listening on ${DEFAULT_PORT}`);
    });
  });
}
