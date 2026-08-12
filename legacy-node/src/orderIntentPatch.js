const PAYMENT_STATUSES = new Set(["pending", "paid_externally"]);
const DELIVERY_STATUSES = new Set([
  "pending",
  "out_for_delivery",
  "delivered"
]);

export function validatePatchOrderIntentRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }
  const hasPayment = payload.payment_status != null;
  const hasDelivery = payload.delivery_status != null;
  const hasPhoto =
    typeof payload.delivery_photo_url === "string" &&
    payload.delivery_photo_url.trim().length > 0;
  if (!hasPayment && !hasDelivery && !hasPhoto) {
    return "Provide payment_status, delivery_status, and/or delivery_photo_url.";
  }
  if (
    hasPayment &&
    !PAYMENT_STATUSES.has(String(payload.payment_status).trim())
  ) {
    return "payment_status must be pending or paid_externally.";
  }
  if (
    hasDelivery &&
    !DELIVERY_STATUSES.has(String(payload.delivery_status).trim())
  ) {
    return "delivery_status must be pending, out_for_delivery, or delivered.";
  }
  return null;
}

/**
 * @param {object} existing
 * @param {object} payload
 * @param {{ role: string, now?: Date }} options
 */
export function applyOrderIntentPatch(existing, payload, { role, now = new Date() }) {
  const isCoordinator = role === "coordinator";
  const next = { ...existing, updated_at: now.toISOString() };

  if (payload.payment_status != null) {
    if (!isCoordinator && payload.payment_status !== "paid_externally") {
      throw Object.assign(new Error("Donors may only set payment_status to paid_externally."), {
        code: "forbidden_patch"
      });
    }
    next.payment_status = String(payload.payment_status).trim();
  }

  if (payload.delivery_status != null) {
    if (!isCoordinator) {
      throw Object.assign(new Error("Only coordinators may update delivery_status."), {
        code: "forbidden_patch"
      });
    }
    next.delivery_status = String(payload.delivery_status).trim();
    if (next.delivery_status === "delivered") {
      next.delivered_at = now.toISOString();
    }
  }

  if (typeof payload.delivery_photo_url === "string") {
    if (!isCoordinator) {
      throw Object.assign(new Error("Only coordinators may set delivery_photo_url."), {
        code: "forbidden_patch"
      });
    }
    next.delivery_photo_url = payload.delivery_photo_url.trim();
  }

  return next;
}
