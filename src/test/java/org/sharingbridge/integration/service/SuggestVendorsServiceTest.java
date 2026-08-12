package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.client.AiOrchestrationClient;
import org.sharingbridge.integration.client.AiOrchestrationProperties;

class SuggestVendorsServiceTest {

    @Test
    void validateRequiresQueryAndPrecision() {
        assertEquals(
                "query_text is required.",
                SuggestVendorsService.validateSuggestVendorsRequest(
                        Map.of("location_precision", "city")));
        assertEquals(
                "location_precision is required.",
                SuggestVendorsService.validateSuggestVendorsRequest(Map.of("query_text", "dosa")));
        assertNull(SuggestVendorsService.validateSuggestVendorsRequest(
                Map.of("query_text", "dosa", "location_precision", "city")));
    }

    @Test
    void failsClosedWhenAiDisabled() {
        AiOrchestrationProperties props = AiOrchestrationProperties.fromEnvironment(Map.of());
        SuggestVendorsService service =
                new SuggestVendorsService(new AiOrchestrationClient(props), props);
        AiServiceUnavailableException ex = assertThrows(
                AiServiceUnavailableException.class,
                () -> service.resolveSuggestVendorsResponse(
                        Map.of("query_text", "dosa", "location_precision", "city")));
        assertEquals("ai_disabled", ex.getCode());
        assertTrue(ex.getMessage().contains("AI_ORCHESTRATION_BASE_URL"));
    }
}
