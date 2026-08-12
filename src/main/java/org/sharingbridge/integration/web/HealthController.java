package org.sharingbridge.integration.web;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.sharingbridge.integration.service.AiBridgeStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    private static final Set<String> KNOWN_LEVELS = Set.of("error", "warn", "info", "debug");

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("service", "integration-service");
        body.put("log_level", resolveLogLevel());
        body.put("ai", AiBridgeStatus.fromEnvironment());
        return body;
    }

    static String resolveLogLevel() {
        String raw = System.getenv("LOG_LEVEL");
        if (raw == null || raw.isBlank()) {
            return "warn";
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        return KNOWN_LEVELS.contains(normalized) ? normalized : "warn";
    }
}
