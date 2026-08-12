package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class InstructionPackServiceTest {

    @Test
    void validateOptionalPresets() {
        assertNull(InstructionPackService.validateInstructionPackRequest(Map.of()));
        assertEquals(
                "presets must be an array when provided.",
                InstructionPackService.validateInstructionPackRequest(Map.of("presets", "nope")));
        assertEquals(
                "Each preset must include restaurant_name, menu_items, and app_name.",
                InstructionPackService.validateInstructionPackRequest(
                        Map.of("presets", List.of(Map.of("restaurant_name", "A")))));
    }

    @Test
    void mapsRequestWithDefaults() {
        Map<String, Object> mapped =
                InstructionPackService.mapInstructionPackRequest(Map.of("verbal_handover_notes", "gate"), "u1");
        assertEquals("u1", mapped.get("user_id"));
        assertEquals("gate", mapped.get("verbal_handover_notes"));
        assertEquals(false, mapped.get("has_reference_photo"));
        assertEquals(List.of(), mapped.get("presets"));
    }
}
