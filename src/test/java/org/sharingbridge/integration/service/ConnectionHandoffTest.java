package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ConnectionHandoffTest {

    private static final Map<String, Object> SEEKER_DEMAND;
    private static final Map<String, Object> KITCHEN;

    static {
        Map<String, Object> demand = new HashMap<>();
        demand.put("id", "sd-1");
        demand.put("order_code", "SB-7K2M-9F3");
        demand.put("initiation_route", "eco_kitchen_pledge");
        demand.put("reported_by_user_id", "initiator-1");
        demand.put("status", "recorded");
        demand.put("meal_units", 4);
        demand.put("standard_offer_id", "so-lunch");
        demand.put("menu_label", "Lunch");
        demand.put("price_inr", 120);
        demand.put("need_description", "Lunch");
        demand.put("locality_key", "IN:TN:600115");
        demand.put("created_at", "2026-06-01T10:00:00Z");
        demand.put("updated_at", "2026-06-01T10:00:00Z");
        SEEKER_DEMAND = demand;

        Map<String, Object> kitchen = new HashMap<>();
        kitchen.put("id", "vb-1");
        kitchen.put("submitted_by_user_id", "kitchen-1");
        kitchen.put("locality_key", "IN:TN:600115");
        kitchen.put("standard_offer_id", "so-lunch");
        kitchen.put("vendor_name", "Green Kitchen");
        kitchen.put("portions", 20);
        kitchen.put("status", "submitted");
        kitchen.put("commitment_status", "committed");
        kitchen.put("order_code", "SB-7K2M-9F3");
        kitchen.put("seeker_demand_id", "sd-1");
        kitchen.put("created_at", "2026-06-01T11:00:00Z");
        kitchen.put("updated_at", "2026-06-01T11:00:00Z");
        KITCHEN = kitchen;
    }

    @Test
    void resolveConnectionViewerRoleIdentifiesInitiatorAndPledger() {
        assertEquals(
                "initiator",
                ConnectionHandoff.resolveConnectionViewerRole(
                        "initiator-1",
                        "donor",
                        SEEKER_DEMAND,
                        KITCHEN,
                        List.of(Map.of("pledged_by_user_id", "pledger-1"))));
        assertEquals(
                "pledger",
                ConnectionHandoff.resolveConnectionViewerRole(
                        "pledger-1",
                        "donor",
                        SEEKER_DEMAND,
                        KITCHEN,
                        List.of(Map.of("pledged_by_user_id", "pledger-1"))));
        assertEquals(
                "kitchen",
                ConnectionHandoff.resolveConnectionViewerRole(
                        "kitchen-1", "donor", SEEKER_DEMAND, KITCHEN, List.of()));
        assertNull(
                ConnectionHandoff.resolveConnectionViewerRole(
                        "stranger", "donor", SEEKER_DEMAND, KITCHEN, List.of()));
    }

    @Test
    void buildConnectionHandoffExposesKitchenEmailWhenReady() {
        Map<String, Object> handoff =
                ConnectionHandoff.buildConnectionHandoff(
                        "SB-7K2M-9F3",
                        SEEKER_DEMAND,
                        KITCHEN,
                        List.of(),
                        Map.of("kitchen-1", "kitchen@example.com", "initiator-1", "initiator@example.com"),
                        "initiator");
        assertEquals("ready", handoff.get("status"));
        assertEquals(ConnectionHandoff.CONNECTION_SAFETY_COPY, handoff.get("safety_copy"));
        @SuppressWarnings("unchecked")
        Map<String, Object> kitchen = (Map<String, Object>) handoff.get("kitchen");
        assertEquals("kitchen@example.com", kitchen.get("login_email"));
        assertEquals("kitchen@example.com", handoff.get("counterparty_email"));
        assertEquals("Green Kitchen", kitchen.get("display_name"));
        @SuppressWarnings("unchecked")
        Map<String, Object> demand = (Map<String, Object>) handoff.get("demand");
        assertEquals("sd-1", demand.get("seeker_demand_id"));
        assertEquals("Lunch", demand.get("need_description"));
        assertEquals("so-lunch", demand.get("standard_offer_id"));
    }

    @Test
    void buildConnectionHandoffHidesEmailsUntilKitchenCommits() {
        Map<String, Object> handoff =
                ConnectionHandoff.buildConnectionHandoff(
                        "SB-7K2M-9F3", SEEKER_DEMAND, null, List.of(), Map.of(), "initiator");
        assertEquals("pending_kitchen", handoff.get("status"));
        assertNull(handoff.get("kitchen"));
        assertEquals(ConnectionHandoff.CONNECTION_SAFETY_COPY, handoff.get("safety_copy"));
    }

    @Test
    void buildConnectionHandoffExposesPledgersToKitchen() {
        Map<String, Object> pledge = new HashMap<>();
        pledge.put("id", "pl-1");
        pledge.put("pledged_by_user_id", "pledger-1");
        pledge.put("locality_key", "IN:TN:600115");
        pledge.put("standard_offer_id", "so-lunch");
        pledge.put("meal_units", 2);
        pledge.put("status", "pledged");
        pledge.put("created_at", "2026-06-01T10:30:00Z");
        pledge.put("updated_at", "2026-06-01T10:30:00Z");
        Map<String, Object> handoff =
                ConnectionHandoff.buildConnectionHandoff(
                        "SB-7K2M-9F3",
                        SEEKER_DEMAND,
                        KITCHEN,
                        List.of(pledge),
                        Map.of("kitchen-1", "kitchen@example.com", "pledger-1", "pledger@example.com"),
                        "kitchen");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pledgers = (List<Map<String, Object>>) handoff.get("pledgers");
        assertEquals(1, pledgers.size());
        assertEquals("pledger@example.com", pledgers.get(0).get("login_email"));
    }

    @Test
    void safetyCopyIsExact() {
        assertEquals(
                "Confirm this order code in SharingBridge before paying anyone. We never send payment links or QR codes by email.",
                ConnectionHandoff.CONNECTION_SAFETY_COPY);
    }
}
