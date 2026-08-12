/** Coordinator delivery patch for eco-kitchen seeker demands. */

const TERMINAL_STATUSES = new Set(["fulfilled", "cancelled"]);

export function validateSeekerDemandPatchPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }
  const hasDelivery = payload.delivery_status != null;
  const hasStatus = payload.status != null;
  if (!hasDelivery && !hasStatus) {
    return "Provide delivery_status and/or status.";
  }
  if (
    hasDelivery &&
    String(payload.delivery_status).trim() !== "delivered"
  ) {
    return "delivery_status must be delivered.";
  }
  if (hasStatus) {
    const status = String(payload.status).trim().toLowerCase();
    if (!TERMINAL_STATUSES.has(status)) {
      return "status must be fulfilled or cancelled.";
    }
  }
  return null;
}

export function applySeekerDemandPatch(existing, payload, { coordinator, now = new Date() }) {
  const validationError = validateSeekerDemandPatchPayload(payload);
  if (validationError) {
    throw Object.assign(new Error(validationError), {
      status: 400,
      code: "invalid_request"
    });
  }
  if (!coordinator) {
    throw Object.assign(
      new Error("Only coordinators may update seeker demand delivery."),
      { status: 403, code: "forbidden" }
    );
  }

  const next = { ...existing, updated_at: now.toISOString() };

  if (payload.delivery_status != null) {
    next.status = "fulfilled";
    next.delivered_at = now.toISOString();
  }
  if (payload.status != null) {
    next.status = String(payload.status).trim().toLowerCase();
    if (next.status === "fulfilled" && !next.delivered_at) {
      next.delivered_at = now.toISOString();
    }
  }

  return next;
}
