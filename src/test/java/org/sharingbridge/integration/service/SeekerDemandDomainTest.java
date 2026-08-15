package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.web.ApiException;

class SeekerDemandDomainTest {

    @Test
    void validateCreateSeekerDemandRequestRequiresStandardOfferId() {
        assertEquals(
                "standard_offer_id is required. Choose a standard menu item for this area.",
                SeekerDemands.validateCreateSeekerDemandRequest(Map.of("meal_units", 2)));
    }

    @Test
    void validateCreateSeekerDemandRequestRequiresEmailShareConsent() {
        String error =
                SeekerDemands.validateCreateSeekerDemandRequest(
                        Map.of("standard_offer_id", "so-lunch-full", "meal_units", 1));
        assertTrue(error != null && error.contains("email_share_consent"));
    }

    @Test
    void buildSeekerDemandRecordAssignsEcoKitchenSelfPayWhenRequested() {
        Map<String, Object> offer =
                Map.of("id", "so-lunch-full", "menu_label", "Full course lunch (veg meals)", "price_inr", 120);
        Map<String, Object> record =
                SeekerDemands.buildSeekerDemandRecord(
                        Map.of(
                                "standard_offer_id",
                                offer.get("id"),
                                "meal_units",
                                2,
                                "email_share_consent",
                                true,
                                "initiation_route",
                                "eco_kitchen_self_pay"),
                        "u1",
                        offer);
        assertEquals("eco_kitchen_self_pay", record.get("initiation_route"));
    }

    @Test
    void buildSeekerDemandRecordAssignsIdAndMenuFromOffer() {
        Map<String, Object> offer =
                Map.of("id", "so-lunch-full", "menu_label", "Full course lunch (veg meals)", "price_inr", 120);
        Map<String, Object> record =
                SeekerDemands.buildSeekerDemandRecord(
                        Map.of(
                                "standard_offer_id",
                                offer.get("id"),
                                "meal_units",
                                3,
                                "email_share_consent",
                                true),
                        "u1",
                        offer);
        assertTrue(String.valueOf(record.get("id")).startsWith("sd-"));
        assertTrue(OrderCode.isValidOrderCode(record.get("order_code")));
        assertEquals("eco_kitchen_pledge", record.get("initiation_route"));
        assertNotNull(record.get("initiator_email_share_consent_at"));
        assertEquals(3, record.get("meal_units"));
        assertEquals(offer.get("id"), record.get("standard_offer_id"));
        assertEquals(offer.get("menu_label"), record.get("menu_label"));
        assertEquals(offer.get("menu_label"), record.get("need_description"));
        assertEquals("u1", record.get("reported_by_user_id"));
    }

    @Test
    void aggregateDemandByLocalitySumsMealUnits() {
        List<Map<String, Object>> rows =
                SeekerDemands.aggregateDemandByLocality(
                        List.of(
                                Map.of(
                                        "locality_key",
                                        "IN:TN:600115",
                                        "meal_units",
                                        2,
                                        "updated_at",
                                        "2026-06-06T10:00:00Z"),
                                Map.of(
                                        "locality_key",
                                        "IN:TN:600115",
                                        "meal_units",
                                        1,
                                        "updated_at",
                                        "2026-06-06T11:00:00Z")));
        assertEquals(1, rows.size());
        assertEquals(3L, ((Number) rows.get(0).get("meal_units_total")).longValue());
        assertEquals(2, rows.get(0).get("demand_count"));
    }

    @Test
    void coordinatorDeliveryPatchMarksSeekerDemandFulfilled() {
        Instant now = Instant.parse("2026-06-02T12:00:00.000Z");
        Map<String, Object> patched =
                SeekerDemandPatch.applySeekerDemandPatch(
                        Map.of("id", "sd-1", "status", "recorded", "updated_at", "2026-06-01T10:00:00.000Z"),
                        Map.of("delivery_status", "delivered"),
                        true,
                        now);
        assertEquals("fulfilled", patched.get("status"));
        assertEquals(now.toString(), patched.get("delivered_at"));
    }

    @Test
    void nonCoordinatorCannotPatchSeekerDemandDelivery() {
        ApiException ex =
                assertThrows(
                        ApiException.class,
                        () ->
                                SeekerDemandPatch.applySeekerDemandPatch(
                                        Map.of("id", "sd-1", "status", "recorded"),
                                        Map.of("delivery_status", "delivered"),
                                        false,
                                        Instant.now()));
        assertTrue(ex.getMessage().contains("Only coordinators"));
    }
}
