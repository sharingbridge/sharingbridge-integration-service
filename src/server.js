import "dotenv/config";
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
import {
  UserServicePreferencesError,
  UserServicePreferencesRepository
} from "./preferencesRepository.js";
import {
  extractAuthFromHeaders,
  extractUserIdFromHeaders,
  requireDonorRole,
  requireReporterRole,
  resolveAuthenticatedUserId
} from "./authContext.js";
import { OrderIntentStore } from "./orderIntentStore.js";
import { PostgresOrderIntentStore } from "./postgresOrderIntentStore.js";
import {
  buildOrderIntentRecord,
  formatOrderIntentForApi,
  mergeOrderIntentRecord,
  validateCreateOrderIntentRequest
} from "./orderIntents.js";
import { lookupDonorEmailsByUserId } from "./donorEmailLookup.js";
import {
  formatOrderIntentsForRole,
  isCoordinatorApiRole
} from "./orderIntentViews.js";
import { listOrderIntentsForDashboard } from "./orderIntentList.js";
import { getOrderIntentListMaxRows } from "./orderIntentListMaxRows.js";
import { formatSinceQuery, resolveListSinceMs } from "./sinceFilter.js";
import { getDonorNeighbourhoodRadiusM } from "./donorNeighbourhoodArea.js";
import { getDonorNeighbourhoodWindowHours } from "./donorNeighbourhoodWindow.js";
import {
  formatNeighbourhoodResponse,
  resolveNeighbourhoodScope
} from "./neighbourhoodFilter.js";
import {
  applyLocationToRecord,
  locationFromPayload,
  mergeLocationFromPayload
} from "./orderIntentLocation.js";
import {
  applyCorsHeaders,
  handleCorsPreflight,
  parseCorsOrigins
} from "./cors.js";
import { buildAiBridgeStatus, buildStartupConfig } from "./aiBridgeStatus.js";
import {
  logListenMessage,
  logStartupDiagnostics,
  resolveLogLevel
} from "./serviceLog.js";
import { normalizeIntegrationApiPath } from "./apiPathAliases.js";

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
 * Tests inject a LocalPreferencesRepository with a temp-directory store.
 * Production startup always uses UserServicePreferencesRepository (Postgres via user-service).
 */
export function createIntegrationServer({
  preferencesRepository,
  aiOrchestrationClient = new AiOrchestrationClient(),
  orderIntentStore = new OrderIntentStore(),
  seekerDemandStore = null,
  marketplaceStore = null,
  corsConfig = parseCorsOrigins()
}) {
  if (!preferencesRepository) {
    throw new Error(
      "createIntegrationServer requires preferencesRepository"
    );
  }
  if (!orderIntentStore) {
    throw new Error("createIntegrationServer requires orderIntentStore");
  }
  return createServer(async (req, res) => {
    req.url = normalizeIntegrationApiPath(req.url);
    applyCorsHeaders(req, res, corsConfig);
    if (handleCorsPreflight(req, res, corsConfig)) {
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "integration-service",
        log_level: resolveLogLevel(),
        ai: buildAiBridgeStatus()
      });
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
          if (error?.status === 503) {
            return sendJson(res, 503, {
              code: error.code || "ai_unavailable",
              message: error?.message || "AI service unavailable."
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
          const auth = extractAuthFromHeaders(req.headers);
          const donorGuard = requireDonorRole(auth);
          if (donorGuard.error) {
            return sendJson(res, donorGuard.error.status, donorGuard.error.body);
          }
          const headerUserId = auth.userId;
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
          if (error?.status === 503) {
            return sendJson(res, 503, {
              code: error.code || "ai_unavailable",
              message: error?.message || "AI service unavailable."
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
      (req.url === "/v1/standard-offers" ||
        req.url.startsWith("/v1/standard-offers?"))
    ) {
      const auth = extractAuthFromHeaders(req.headers);
      if (!auth) {
        return sendJson(res, 401, {
          code: "missing_auth_context",
          message: "A valid Bearer token is required."
        });
      }
      if (!marketplaceStore) {
        return sendJson(res, 503, {
          code: "marketplace_unavailable",
          message: "Marketplace store is not configured."
        });
      }
      try {
        const requestUrl = new URL(req.url, "http://localhost");
        const localityKey = requestUrl.searchParams.get("locality_key");
        const latParam = requestUrl.searchParams.get("location_lat");
        const lngParam = requestUrl.searchParams.get("location_lng");
        let resolvedLocalityKey =
          typeof localityKey === "string" ? localityKey.trim() : "";
        if (!resolvedLocalityKey && latParam != null && lngParam != null) {
          const { derivePostalLocalityKey } = await import(
            "./postalGeocode.js"
          );
          const lat = Number(latParam);
          const lng = Number(lngParam);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            resolvedLocalityKey =
              (await derivePostalLocalityKey(lat, lng)) ?? "";
          }
        }
        const { formatStandardOfferForApi } = await import(
          "./standardOffers.js"
        );
        const { resolveStandardOffersForLocality } = await import(
          "./localityKey.js"
        );
        const catalog = await marketplaceStore.listStandardOffers({
          localityKey: null
        });
        const rows = resolvedLocalityKey
          ? resolveStandardOffersForLocality(catalog, resolvedLocalityKey)
          : catalog;
        return sendJson(res, 200, {
          user_id: auth.userId,
          locality_key: resolvedLocalityKey || null,
          standard_offers: rows.map(formatStandardOfferForApi)
        });
      } catch (error) {
        return sendJson(res, error?.status || 500, {
          code: error?.code || "standard_offers_list_error",
          message: error?.message || "Could not list standard offers."
        });
      }
    }

    if (req.method === "GET" && req.url === "/v1/demand/board") {
      const auth = extractAuthFromHeaders(req.headers);
      if (!auth) {
        return sendJson(res, 401, {
          code: "missing_auth_context",
          message: "A valid Bearer token is required."
        });
      }
      try {
        const { buildDemandBoardSnapshot } = await import("./demandBoard.js");
        const snapshot = await buildDemandBoardSnapshot({
          role: auth.role,
          seekerDemandStore,
          marketplaceStore
        });
        return sendJson(res, 200, snapshot);
      } catch (error) {
        return sendJson(res, 500, {
          code: error?.code || "demand_board_error",
          message: error?.message || "Could not load demand board."
        });
      }
    }

    if (req.method === "POST" && req.url === "/v1/pledges") {
      readJsonBody(req)
        .then(async (payload) => {
          const auth = extractAuthFromHeaders(req.headers);
          const donorGuard = requireDonorRole(auth);
          if (donorGuard.error) {
            return sendJson(res, donorGuard.error.status, donorGuard.error.body);
          }
          if (!marketplaceStore) {
            return sendJson(res, 503, {
              code: "marketplace_unavailable",
              message: "Marketplace store is not configured."
            });
          }
          const {
            validateCreatePledgeRequest,
            buildPledgeRecord,
            formatPledgeForApi
          } = await import("./marketplace.js");
          const validationError = validateCreatePledgeRequest(payload);
          if (validationError) {
            return sendJson(res, 400, {
              code: "invalid_request",
              message: validationError
            });
          }
          const { resolveActiveOfferBuckets } = await import("./demandBoard.js");
          const { validateMarketplaceOfferSelection } = await import(
            "./marketplace.js"
          );
          const activeBuckets = await resolveActiveOfferBuckets(
            seekerDemandStore
          );
          const offerError = validateMarketplaceOfferSelection(
            payload.locality_key,
            payload.standard_offer_id,
            activeBuckets
          );
          if (offerError) {
            return sendJson(res, 400, {
              code: "invalid_offer_selection",
              message: offerError
            });
          }
          const offer = await marketplaceStore.getStandardOfferById(
            payload.standard_offer_id
          );
          const record = buildPledgeRecord(
            {
              ...payload,
              menu_label: offer?.menu_label ?? payload.menu_label
            },
            {
              pledgedByUserId: auth.userId
            }
          );
          const saved = await marketplaceStore.insertPledge(record);
          return sendJson(res, 201, {
            pledge: formatPledgeForApi(saved)
          });
        })
        .catch((error) => {
          if (error?.message === "invalid_json") {
            return sendJson(res, 400, {
              code: "invalid_json",
              message: "Request body must be valid JSON."
            });
          }
          return sendJson(res, error?.status || 500, {
            code: error?.code || "internal_error",
            message: error?.message || "Unexpected error."
          });
        });
      return;
    }

    if (req.method === "POST" && req.url === "/v1/vendor-bids") {
      readJsonBody(req)
        .then(async (payload) => {
          const auth = extractAuthFromHeaders(req.headers);
          if (!auth) {
            return sendJson(res, 401, {
              code: "missing_auth_context",
              message: "A valid Bearer token is required."
            });
          }
          if (!isCoordinatorApiRole(auth.role)) {
            return sendJson(res, 403, {
              code: "forbidden",
              message: "Coordinator role required to submit vendor bids (MVP)."
            });
          }
          if (!marketplaceStore) {
            return sendJson(res, 503, {
              code: "marketplace_unavailable",
              message: "Marketplace store is not configured."
            });
          }
          const {
            validateCreateVendorBidRequest,
            buildVendorBidRecord,
            formatVendorBidForApi
          } = await import("./marketplace.js");
          const validationError = validateCreateVendorBidRequest(payload);
          if (validationError) {
            return sendJson(res, 400, {
              code: "invalid_request",
              message: validationError
            });
          }
          const { resolveActiveOfferBuckets } = await import("./demandBoard.js");
          const { validateMarketplaceOfferSelection } = await import(
            "./marketplace.js"
          );
          const activeBuckets = await resolveActiveOfferBuckets(
            seekerDemandStore
          );
          const offerError = validateMarketplaceOfferSelection(
            payload.locality_key,
            payload.standard_offer_id,
            activeBuckets
          );
          if (offerError) {
            return sendJson(res, 400, {
              code: "invalid_offer_selection",
              message: offerError
            });
          }
          const offer = await marketplaceStore.getStandardOfferById(
            payload.standard_offer_id
          );
          const record = buildVendorBidRecord(
            {
              ...payload,
              menu_label: offer?.menu_label ?? payload.menu_label
            },
            {
              submittedByUserId: auth.userId
            }
          );
          const saved = await marketplaceStore.insertVendorBid(record);
          return sendJson(res, 201, {
            vendor_bid: formatVendorBidForApi(saved)
          });
        })
        .catch((error) => {
          if (error?.message === "invalid_json") {
            return sendJson(res, 400, {
              code: "invalid_json",
              message: "Request body must be valid JSON."
            });
          }
          return sendJson(res, error?.status || 500, {
            code: error?.code || "internal_error",
            message: error?.message || "Unexpected error."
          });
        });
      return;
    }

    if (
      req.method === "GET" &&
      (req.url === "/v1/seeker-demands" ||
        req.url.startsWith("/v1/seeker-demands?"))
    ) {
      const auth = extractAuthFromHeaders(req.headers);
      if (!auth) {
        return sendJson(res, 401, {
          code: "missing_auth_context",
          message: "A valid Bearer token is required."
        });
      }
      if (!seekerDemandStore) {
        return sendJson(res, 503, {
          code: "seeker_demand_unavailable",
          message: "Seeker demand store is not configured."
        });
      }
      try {
        const { formatSeekerDemandForApi } = await import("./seekerDemands.js");
        const reporterFilter = isCoordinatorApiRole(auth.role)
          ? null
          : auth.userId;
        const rows = await seekerDemandStore.listRecent({
          limit: 100,
          reporterUserIdFilter: reporterFilter
        });
        return sendJson(res, 200, {
          user_id: auth.userId,
          role: auth.role,
          seeker_demands: rows.map(formatSeekerDemandForApi)
        });
      } catch (error) {
        return sendJson(res, error?.status || 500, {
          code: error?.code || "seeker_demand_list_error",
          message: error?.message || "Could not list seeker demands."
        });
      }
    }

    if (req.method === "POST" && req.url === "/v1/seeker-demands") {
      readJsonBody(req)
        .then(async (payload) => {
          const auth = extractAuthFromHeaders(req.headers);
          const reporterGuard = requireReporterRole(auth);
          if (reporterGuard.error) {
            return sendJson(
              res,
              reporterGuard.error.status,
              reporterGuard.error.body
            );
          }
          const {
            validateCreateSeekerDemandRequest,
            buildSeekerDemandRecord,
            formatSeekerDemandForApi
          } = await import("./seekerDemands.js");
          const validationError = validateCreateSeekerDemandRequest(payload);
          if (validationError) {
            return sendJson(res, 400, {
              code: "invalid_request",
              message: validationError
            });
          }
          if (!seekerDemandStore) {
            return sendJson(res, 503, {
              code: "seeker_demand_unavailable",
              message: "Seeker demand store is not configured."
            });
          }
          if (!marketplaceStore) {
            return sendJson(res, 503, {
              code: "marketplace_unavailable",
              message: "Standard offers catalog is not configured."
            });
          }
          const standardOffer = await marketplaceStore.getStandardOfferById(
            payload.standard_offer_id
          );
          if (!standardOffer) {
            return sendJson(res, 400, {
              code: "invalid_standard_offer_id",
              message:
                "standard_offer_id not found. Choose a menu item for this area."
            });
          }
          const { applyLocationToRecord, locationFromPayload } =
            await import("./orderIntentLocation.js");
          let record = buildSeekerDemandRecord(payload, {
            reportedByUserId: auth.userId,
            standardOffer
          });
          record = applyLocationToRecord(
            record,
            await locationFromPayload(payload)
          );
          if (!record.locality_key) {
            return sendJson(res, 400, {
              code: "location_required",
              message:
                "location_lat and location_lng are required to resolve postal area (IN:TN:PIN)."
            });
          }
          const { offerAppliesToLocality } = await import("./localityKey.js");
          if (!offerAppliesToLocality(standardOffer.locality_key, record.locality_key)) {
            return sendJson(res, 400, {
              code: "offer_locality_mismatch",
              message: `This menu item is for ${standardOffer.locality_key} but GPS resolves to ${record.locality_key}. Pick an item for your postal area.`
            });
          }
          const saved = await seekerDemandStore.insertForReporter(
            auth.userId,
            record
          );
          return sendJson(res, 201, {
            user_id: auth.userId,
            created: true,
            seeker_demand: formatSeekerDemandForApi(saved)
          });
        })
        .catch((error) => {
          if (error?.message === "invalid_json") {
            return sendJson(res, 400, {
              code: "invalid_json",
              message: "Request body must be valid JSON."
            });
          }
          return sendJson(res, error?.status || 500, {
            code: error?.code || "seeker_demand_create_error",
            message: error?.message || "Could not save seeker demand."
          });
        });
      return;
    }

    if (
      req.method === "GET" &&
      (req.url === "/v1/donor-seeker/order-intents" ||
        req.url.startsWith("/v1/donor-seeker/order-intents?"))
    ) {
      const requestUrl = new URL(req.url, "http://localhost");
      const queryUserId = requestUrl.searchParams.get("user_id");
      const auth = extractAuthFromHeaders(req.headers);
      if (!auth) {
        return sendJson(res, 401, {
          code: "missing_auth_context",
          message: "A valid Bearer token is required."
        });
      }
      const filter =
        typeof queryUserId === "string" && queryUserId.trim()
          ? queryUserId.trim()
          : null;
      const sinceMs = resolveListSinceMs(
        auth.role,
        requestUrl.searchParams.get("since")
      );
      const neighbourhoodScope = resolveNeighbourhoodScope(
        auth.role,
        requestUrl.searchParams
      );
      const records = await listOrderIntentsForDashboard(orderIntentStore, {
        userIdFilter: filter,
        sinceMs,
        neighbourhoodScope,
        viewerUserId: auth.userId,
        role: auth.role,
        maxRows: getOrderIntentListMaxRows()
      });
      let donorEmailByUserId = {};
      if (isCoordinatorApiRole(auth.role) && orderIntentStore.pool) {
        try {
          donorEmailByUserId = await lookupDonorEmailsByUserId(
            orderIntentStore.pool,
            records.map((record) => record.user_id)
          );
        } catch {
          donorEmailByUserId = {};
        }
      }
      const orderIntents = await formatOrderIntentsForRole(records, auth.role, {
        donorEmailByUserId,
        viewerUserId: auth.userId
      });
      const payload = {
        user_id: auth.userId,
        role: auth.role,
        dashboard: isCoordinatorApiRole(auth.role) ? "coordinator" : "limited",
        order_intents: orderIntents
      };
      if (sinceMs != null) {
        payload.since = formatSinceQuery(sinceMs);
      }
      let viewerLocalityKey = null;
      if (neighbourhoodScope?.type === "near") {
        const { derivePostalLocalityKey } = await import("./postalGeocode.js");
        viewerLocalityKey = await derivePostalLocalityKey(
          neighbourhoodScope.nearLat,
          neighbourhoodScope.nearLng
        );
      }
      const neighbourhood = formatNeighbourhoodResponse(
        neighbourhoodScope,
        viewerLocalityKey
      );
      if (neighbourhood) {
        payload.neighbourhood = neighbourhood;
      } else if (!isCoordinatorApiRole(auth.role)) {
        payload.neighbourhood = { mode: "own_only" };
      }
      if (!isCoordinatorApiRole(auth.role) && sinceMs != null) {
        payload.feed = {
          since: payload.since,
          window_hours: getDonorNeighbourhoodWindowHours(),
          radius_m: getDonorNeighbourhoodRadiusM(),
          location_mode: neighbourhoodScope?.type ?? "own_only"
        };
      }
      return sendJson(res, 200, payload);
    }

    if (req.method === "PATCH") {
      const patchUrl = new URL(req.url, "http://localhost");
      const patchPrefix = "/v1/donor-seeker/order-intents/";
      if (patchUrl.pathname.startsWith(patchPrefix)) {
        const orderIntentId = decodeURIComponent(
          patchUrl.pathname.slice(patchPrefix.length)
        );
        try {
          const payload = await readJsonBody(req);
          const auth = extractAuthFromHeaders(req.headers);
          if (!auth) {
            return sendJson(res, 401, {
              code: "missing_auth_context",
              message: "A valid Bearer token is required."
            });
          }
          const {
            validatePatchOrderIntentRequest,
            applyOrderIntentPatch
          } = await import("./orderIntentPatch.js");
          const validationError = validatePatchOrderIntentRequest(payload);
          if (validationError) {
            return sendJson(res, 400, {
              code: "invalid_request",
              message: validationError
            });
          }
          const coordinator = isCoordinatorApiRole(auth.role);
          let existing = null;
          let ownerUserId = auth.userId;
          if (coordinator) {
            existing = await orderIntentStore.findByIdAny?.(orderIntentId);
            ownerUserId = existing?.user_id ?? auth.userId;
          } else {
            const donorGuard = requireDonorRole(auth);
            if (donorGuard.error) {
              return sendJson(
                res,
                donorGuard.error.status,
                donorGuard.error.body
              );
            }
            existing = await orderIntentStore.findById(auth.userId, orderIntentId);
          }
          if (!existing) {
            return sendJson(res, 404, {
              code: "not_found",
              message: "Order intent not found."
            });
          }
          let patched;
          try {
            patched = applyOrderIntentPatch(existing, payload, {
              role: auth.role
            });
          } catch (error) {
            if (error?.code === "forbidden_patch") {
              return sendJson(res, 403, {
                code: "forbidden",
                message: error.message
              });
            }
            throw error;
          }
          const saved = await orderIntentStore.updateRecordForUser?.(
            ownerUserId,
            patched
          );
          if (!saved) {
            return sendJson(res, 500, {
              code: "update_failed",
              message: "Could not update order intent."
            });
          }
          return sendJson(res, 200, {
            order_intent: formatOrderIntentForApi(saved)
          });
        } catch (error) {
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
        }
      }
    }

    if (
      req.method === "POST" &&
      req.url === "/v1/donor-seeker/order-intents"
    ) {
      try {
        const payload = await readJsonBody(req);
        const auth = extractAuthFromHeaders(req.headers);
        const donorGuard = requireDonorRole(auth);
        if (donorGuard.error) {
          return sendJson(res, donorGuard.error.status, donorGuard.error.body);
        }
        const headerUserId = auth.userId;
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
        if (!userId) {
          return sendJson(res, 400, {
            code: "invalid_request",
            message: "user_id is required when no Bearer token is supplied."
          });
        }

        const validationError = validateCreateOrderIntentRequest(payload);
        if (validationError) {
          return sendJson(res, 400, {
            code: "invalid_request",
            message: validationError
          });
        }

        const packId =
          typeof payload.pack_id === "string" ? payload.pack_id.trim() : "";
        const existingByPack =
          packId.length > 0
            ? await orderIntentStore.findByPackId(userId, packId)
            : null;
        const suppliedIntentId =
          typeof payload.order_intent_id === "string"
            ? payload.order_intent_id.trim()
            : "";
        const existingById =
          !existingByPack && suppliedIntentId
            ? await orderIntentStore.findById(userId, suppliedIntentId)
            : null;
        const existing = existingByPack || existingById;

        let record;
        let created;
        if (existing) {
          record = await mergeLocationFromPayload(
            mergeOrderIntentRecord(existing, payload),
            payload
          );
          ({ created } = await orderIntentStore.upsertForUser(userId, record));
        } else {
          record = buildOrderIntentRecord(payload, { userId });
          const location = await locationFromPayload(payload);
          if (location) {
            record = applyLocationToRecord(record, location);
          }
          ({ created } = await orderIntentStore.upsertForUser(userId, record));
        }
        return sendJson(res, created ? 201 : 200, {
          order_intent_id: record.id,
          user_id: userId,
          pack_id: record.pack_id,
          status: record.status,
          created_at: record.created_at,
          updated_at: record.updated_at,
          created
        });
      } catch (error) {
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
      }
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

async function buildDefaultOrderIntentStore() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) {
    throw new Error(
      "DATABASE_URL is required. See configuration/database.md."
    );
  }
  const store = await PostgresOrderIntentStore.create(databaseUrl);
  await store.init();
  return store;
}

async function buildDefaultMarketplaceStore() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return null;
  }
  const { PostgresMarketplaceStore } = await import(
    "./postgresMarketplaceStore.js"
  );
  const store = await PostgresMarketplaceStore.create(databaseUrl);
  await store.init();
  return store;
}

async function buildDefaultSeekerDemandStore() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) {
    return null;
  }
  const { PostgresSeekerDemandStore } = await import(
    "./postgresSeekerDemandStore.js"
  );
  const store = await PostgresSeekerDemandStore.create(databaseUrl);
  await store.init();
  return store;
}

function buildDefaultPreferencesRepository() {
  const baseUrl = process.env.USER_SERVICE_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "USER_SERVICE_BASE_URL is required. Donor presets are stored in Postgres via user-service."
    );
  }
  return new UserServicePreferencesRepository({ baseUrl });
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const preferencesRepository = buildDefaultPreferencesRepository();
  Promise.all([
    buildDefaultOrderIntentStore(),
    buildDefaultSeekerDemandStore(),
    buildDefaultMarketplaceStore()
  ])
    .then(([orderIntentStore, seekerDemandStore, marketplaceStore]) => {
      const server = createIntegrationServer({
        preferencesRepository,
        orderIntentStore,
        seekerDemandStore,
        marketplaceStore
      });
      return Promise.all([preferencesRepository.init()]).then(() => {
        server.listen(DEFAULT_PORT, () => {
          logListenMessage(
            console,
            `Integration service listening on ${DEFAULT_PORT} (PostgreSQL)`
          );
          logStartupDiagnostics(buildStartupConfig());
        });
      });
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error.message || error);
      process.exit(1);
    });
}
