package org.sharingbridge.integration.service;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.http.HttpStatus;

public final class SeekerDemandPatch {

    private static final Set<String> TERMINAL_STATUSES = Set.of("fulfilled", "cancelled");

    private SeekerDemandPatch() {}

    public static String validateSeekerDemandPatchPayload(Map<String, Object> payload) {
        if (payload == null) {
            return "Request body must be a JSON object.";
        }
        boolean hasDelivery = payload.get("delivery_status") != null;
        boolean hasStatus = payload.get("status") != null;
        if (!hasDelivery && !hasStatus) {
            return "Provide delivery_status and/or status.";
        }
        if (hasDelivery && !"delivered".equals(String.valueOf(payload.get("delivery_status")).trim())) {
            return "delivery_status must be delivered.";
        }
        if (hasStatus) {
            String status = String.valueOf(payload.get("status")).trim().toLowerCase();
            if (!TERMINAL_STATUSES.contains(status)) {
                return "status must be fulfilled or cancelled.";
            }
        }
        return null;
    }

    public static Map<String, Object> applySeekerDemandPatch(
            Map<String, Object> existing,
            Map<String, Object> payload,
            boolean coordinator,
            Instant now) {
        String validationError = validateSeekerDemandPatchPayload(payload);
        if (validationError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", validationError);
        }
        if (!coordinator) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "forbidden",
                    "Only coordinators may update seeker demand delivery.");
        }
        Instant when = now == null ? Instant.now() : now;
        Map<String, Object> next = JsValues.copy(existing);
        next.put("updated_at", when.toString());
        if (payload.get("delivery_status") != null) {
            next.put("status", "fulfilled");
            next.put("delivered_at", when.toString());
        }
        if (payload.get("status") != null) {
            next.put("status", String.valueOf(payload.get("status")).trim().toLowerCase());
            if ("fulfilled".equals(next.get("status")) && next.get("delivered_at") == null) {
                next.put("delivered_at", when.toString());
            }
        }
        return next;
    }
}
