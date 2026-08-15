package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.sharingbridge.integration.auth.Roles;

public final class OrderIntentPatch {

    private static final Set<String> PAYMENT_STATUSES = Set.of("pending", "paid_externally");
    private static final Set<String> DELIVERY_STATUSES =
            Set.of("pending", "out_for_delivery", "delivered");

    private OrderIntentPatch() {}

    public static String validatePatchOrderIntentRequest(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        boolean hasPayment = payload.get("payment_status") != null;
        boolean hasDelivery = payload.get("delivery_status") != null;
        boolean hasPhoto =
                payload.get("delivery_photo_url") instanceof String text && !text.trim().isEmpty();
        if (!hasPayment && !hasDelivery && !hasPhoto) {
            return "Provide payment_status, delivery_status, and/or delivery_photo_url.";
        }
        if (hasPayment && !PAYMENT_STATUSES.contains(String.valueOf(payload.get("payment_status")).trim())) {
            return "payment_status must be pending or paid_externally.";
        }
        if (hasDelivery
                && !DELIVERY_STATUSES.contains(String.valueOf(payload.get("delivery_status")).trim())) {
            return "delivery_status must be pending, out_for_delivery, or delivered.";
        }
        return null;
    }

    public static Map<String, Object> applyOrderIntentPatch(
            Map<String, Object> existing, Map<String, Object> payload, String role, Instant now) {
        boolean isCoordinator = Roles.ROLE_COORDINATOR.equals(role);
        Instant when = now == null ? Instant.now() : now;
        Map<String, Object> next = JsValues.copy(existing);
        next.put("updated_at", when.toString());

        if (payload.get("payment_status") != null) {
            if (!isCoordinator && !"paid_externally".equals(String.valueOf(payload.get("payment_status")))) {
                throw new ForbiddenPatchException(
                        "Donors may only set payment_status to paid_externally.");
            }
            next.put("payment_status", String.valueOf(payload.get("payment_status")).trim());
        }

        if (payload.get("delivery_status") != null) {
            if (!isCoordinator) {
                throw new ForbiddenPatchException("Only coordinators may update delivery_status.");
            }
            String delivery = String.valueOf(payload.get("delivery_status")).trim();
            next.put("delivery_status", delivery);
            if ("delivered".equals(delivery)) {
                next.put("delivered_at", when.toString());
            }
        }

        if (payload.get("delivery_photo_url") instanceof String text) {
            if (!isCoordinator) {
                throw new ForbiddenPatchException("Only coordinators may set delivery_photo_url.");
            }
            next.put("delivery_photo_url", text.trim());
        }

        return next;
    }

    public static final class ForbiddenPatchException extends RuntimeException {
        public ForbiddenPatchException(String message) {
            super(message);
        }
    }
}
