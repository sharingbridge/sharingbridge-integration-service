package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PreferencesValidatorsTest {

    @Test
    void saveRequiresNonEmptyPresets() {
        assertEquals(
                "presets must be a non-empty array.",
                PreferencesService.validateSavePresetsRequest(Map.of("user_id", "u1", "presets", List.of())));
    }

    @Test
    void saveRequiresPresetFields() {
        String error = PreferencesService.validateSavePresetsRequest(Map.of(
                "user_id",
                "u1",
                "presets",
                List.of(Map.of("restaurant_name", "A", "order_url", "https://x", "app_name", "Zomato"))));
        assertEquals(
                "Each preset must include restaurant_name, order_url, menu_items, and app_name.",
                error);
    }

    @Test
    void saveAcceptsValidPreset() {
        assertNull(PreferencesService.validateSavePresetsRequest(Map.of(
                "user_id",
                "u1",
                "presets",
                List.of(Map.of(
                        "restaurant_name",
                        "A",
                        "order_url",
                        "https://x",
                        "menu_items",
                        List.of("dosa"),
                        "app_name",
                        "Zomato")))));
    }

    @Test
    void deleteItemRequiresKeys() {
        assertEquals(
                "restaurant_name is required.",
                PreferencesService.validateDeletePresetItemRequest(Map.of("order_url", "https://x")));
        assertEquals(
                "order_url is required.",
                PreferencesService.validateDeletePresetItemRequest(Map.of("restaurant_name", "A")));
    }
}
