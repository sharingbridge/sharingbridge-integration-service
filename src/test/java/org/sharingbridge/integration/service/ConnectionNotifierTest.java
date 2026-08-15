package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class ConnectionNotifierTest {

    @Test
    void buildConnectionReadyEmailIsNotificationOnly() {
        Map<String, String> email = ConnectionNotifier.buildConnectionReadyEmail("SB-7K2M-9F3");
        assertTrue(email.get("subject").contains("SB-7K2M-9F3"));
        assertTrue(email.get("text").contains("Open SharingBridge"));
        assertTrue(email.get("text").toLowerCase().contains("do not send payment links"));
        assertFalse(email.get("text").toLowerCase().contains("mailto:"));
    }

    @Test
    void notifyConnectionReadySendsWebhookSecretHeaderWhenConfigured() {
        AtomicReference<Map<String, String>> captured = new AtomicReference<>();
        ConnectionNotifier notifier =
                new ConnectionNotifier(
                        (url, headers, body) -> {
                            captured.set(headers);
                            return 200;
                        },
                        new ObjectMapper(),
                        "http://notify.test/hook",
                        "test-secret");
        Map<String, Object> result =
                notifier.notifyConnectionReady(
                        "SB-7K2M-9F3",
                        List.of("alice"),
                        ids -> Map.of("alice", "alice@example.com"));
        assertEquals(true, result.get("sent"));
        assertEquals("test-secret", captured.get().get("x-webhook-secret"));
    }
}
