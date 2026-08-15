package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MarketplaceDomainTest {

    @Test
    void enrichDemandWindowsWithSupplyComputesPledgeAndBidGaps() {
        List<Map<String, Object>> windows =
                List.of(
                        Map.of(
                                "bucket_key",
                                "IN:TN:600115::so-lunch-full",
                                "locality_key",
                                "IN:TN:600115",
                                "standard_offer_id",
                                "so-lunch-full",
                                "menu_label",
                                "Full course lunch (veg meals)",
                                "demand_count",
                                2,
                                "meal_units_total",
                                10,
                                "latest_at",
                                "2026-06-10T12:00:00.000Z"),
                        Map.of(
                                "bucket_key",
                                "unknown::legacy",
                                "locality_key",
                                "unknown",
                                "standard_offer_id",
                                "",
                                "demand_count",
                                1,
                                "meal_units_total",
                                3,
                                "latest_at",
                                "2026-06-10T11:00:00.000Z"));
        // Node uses standard_offer_id: null. Empty string may bucket differently.
        List<Map<String, Object>> windowsWithNull =
                List.of(windows.get(0), new java.util.HashMap<>(windows.get(1)));
        windowsWithNull.get(1).put("standard_offer_id", null);
        List<Map<String, Object>> pledges =
                List.of(
                        Map.of(
                                "pledge_id",
                                "pl-1",
                                "locality_key",
                                "IN:TN:600115",
                                "standard_offer_id",
                                "so-lunch-full",
                                "meal_units",
                                4,
                                "status",
                                "pledged",
                                "created_at",
                                "2026-06-10T12:01:00.000Z"));
        List<Map<String, Object>> vendorBids =
                List.of(
                        Map.of(
                                "vendor_bid_id",
                                "vb-1",
                                "locality_key",
                                "IN:TN:600115",
                                "standard_offer_id",
                                "so-lunch-full",
                                "vendor_name",
                                "Kitchen A",
                                "portions",
                                8,
                                "status",
                                "submitted",
                                "created_at",
                                "2026-06-10T12:02:00.000Z"));
        List<Map<String, Object>> enriched =
                Marketplace.enrichDemandWindowsWithSupply(windowsWithNull, pledges, vendorBids);
        assertEquals(4L, ((Number) enriched.get(0).get("pledged_units_total")).longValue());
        assertEquals(8L, ((Number) enriched.get(0).get("bid_portions_total")).longValue());
        assertEquals(6L, ((Number) enriched.get(0).get("unmet_demand_units")).longValue());
        assertEquals(2L, ((Number) enriched.get(0).get("supply_gap_units")).longValue());
        assertEquals("needs_pledges", enriched.get(0).get("allocation_hint"));
        assertEquals(0L, ((Number) enriched.get(1).get("pledged_units_total")).longValue());
        assertEquals(3L, ((Number) enriched.get(1).get("unmet_demand_units")).longValue());
    }

    @Test
    void validateCreatePledgeRequestRequiresConsent() {
        String error =
                Marketplace.validateCreatePledgeRequest(
                        Map.of("locality_key", "IN:TN:600115", "standard_offer_id", "so-lunch-full"));
        assertTrue(error != null && error.contains("email_share_consent"));
        assertNull(
                Marketplace.validateCreatePledgeRequest(
                        Map.of(
                                "locality_key",
                                "IN:TN:600115",
                                "standard_offer_id",
                                "so-lunch-full",
                                "email_share_consent",
                                true)));
    }
}
