import { createServer } from "node:http";
import {
  buildSuggestVendorsResponse,
  validateSuggestVendorsRequest
} from "./suggestVendors.js";

const PORT = Number(process.env.PORT || 8080);

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, service: "integration-service" });
  }

  if (req.method === "POST" && req.url === "/v1/donor-setup/suggest-vendors") {
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

  sendJson(res, 404, {
    code: "not_found",
    message: "Route not found."
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Integration service listening on ${PORT}`);
});
