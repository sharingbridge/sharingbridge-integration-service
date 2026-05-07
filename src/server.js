import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
  buildSuggestVendorsResponse,
  validateGetPresetsRequest,
  validateSavePresetsRequest,
  validateSuggestVendorsRequest
} from "./suggestVendors.js";
import { PreferencesStore } from "./preferencesStore.js";

const DEFAULT_PORT = Number(process.env.PORT || 8080);

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Build an http.Server wired up against the given PreferencesStore. Tests
 * use this factory with a temp DB path; the bin entrypoint at the bottom
 * of this file uses it with the default file-backed store.
 */
export function createIntegrationServer({ preferencesStore }) {
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
      const userId = requestUrl.searchParams.get("user_id");
      const validationError = validateGetPresetsRequest(userId);
      if (validationError) {
        return sendJson(res, 400, {
          code: "invalid_request",
          message: validationError
        });
      }
      return sendJson(res, 200, {
        user_id: userId,
        presets: preferencesStore.getByUser(userId)
      });
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
          id: `${payload.user_id}-preset-${Date.now()}-${index + 1}`,
          saved_at: now
        }));

        preferencesStore
          .saveForUser(payload.user_id, created)
          .then((updated) =>
            sendJson(res, 200, {
              user_id: payload.user_id,
              saved_count: created.length,
              total_count: updated.length,
              preset_ids: created.map((item) => item.id),
              saved_at: now
            })
          )
          .catch((error) =>
            sendJson(res, 500, {
              code: "persistence_error",
              message: `Unable to persist presets: ${error}`
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

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const preferencesStore = new PreferencesStore();
  const server = createIntegrationServer({ preferencesStore });
  preferencesStore.init().then(() => {
    server.listen(DEFAULT_PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Integration service listening on ${DEFAULT_PORT}`);
    });
  });
}
