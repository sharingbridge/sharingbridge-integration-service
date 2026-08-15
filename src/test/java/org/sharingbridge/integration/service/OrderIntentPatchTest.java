package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OrderIntentPatchTest {

    @Test
    void validatePatchOrderIntentRequestAcceptsPaymentStatus() {
        assertNull(OrderIntentPatch.validatePatchOrderIntentRequest(Map.of("payment_status", "paid_externally")));
    }

    @Test
    void donorMayMarkPaymentPaidExternally() {
        Map<String, Object> existing = new HashMap<>();
        existing.put("id", "oi-1");
        existing.put("payment_status", "pending");
        existing.put("delivery_status", "pending");
        Map<String, Object> patched =
                OrderIntentPatch.applyOrderIntentPatch(
                        existing, Map.of("payment_status", "paid_externally"), "donor", Instant.now());
        assertEquals("paid_externally", patched.get("payment_status"));
    }

    @Test
    void donorCannotSetDeliveryStatus() {
        OrderIntentPatch.ForbiddenPatchException ex =
                assertThrows(
                        OrderIntentPatch.ForbiddenPatchException.class,
                        () ->
                                OrderIntentPatch.applyOrderIntentPatch(
                                        Map.of("id", "oi-1", "delivery_status", "pending"),
                                        Map.of("delivery_status", "delivered"),
                                        "donor",
                                        Instant.now()));
        assertEquals("Only coordinators may update delivery_status.", ex.getMessage());
    }

    @Test
    void coordinatorMayMarkDeliveredWithTimestamp() {
        Instant now = Instant.parse("2026-06-05T12:00:00.000Z");
        Map<String, Object> patched =
                OrderIntentPatch.applyOrderIntentPatch(
                        Map.of("id", "oi-1", "delivery_status", "pending"),
                        Map.of("delivery_status", "delivered"),
                        "coordinator",
                        now);
        assertEquals("delivered", patched.get("delivery_status"));
        assertEquals(now.toString(), patched.get("delivered_at"));
    }
}
