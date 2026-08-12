package org.sharingbridge.integration.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class AiOrchestrationPropertiesTest {

    @Test
    void defaultsTimeoutsAndRetries() {
        AiOrchestrationProperties props = AiOrchestrationProperties.fromEnvironment(Map.of());
        assertEquals(15_000L, props.suggestVendorsTimeoutMs());
        assertEquals(60_000L, props.instructionPackTimeoutMs());
        assertEquals(5, props.retryMaxAttempts());
        assertEquals(5, props.suggestVendorsRetryMaxAttempts());
        assertEquals(5, props.instructionPackRetryMaxAttempts());
    }

    @Test
    void readsRouteSpecificOverrides() {
        AiOrchestrationProperties props = AiOrchestrationProperties.fromEnvironment(Map.of(
                "AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS",
                "20000",
                "AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS",
                "90000",
                "AI_ORCHESTRATION_SUGGEST_VENDORS_RETRY_MAX_ATTEMPTS",
                "3"));
        assertEquals(20_000L, props.suggestVendorsTimeoutMs());
        assertEquals(90_000L, props.instructionPackTimeoutMs());
        assertEquals(3, props.suggestVendorsRetryMaxAttempts());
        assertTrue(props.baseUrl().isEmpty());
    }
}
