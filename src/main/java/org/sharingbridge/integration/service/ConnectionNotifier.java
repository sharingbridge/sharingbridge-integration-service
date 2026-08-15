package org.sharingbridge.integration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ConnectionNotifier {

    private static final Logger log = LoggerFactory.getLogger(ConnectionNotifier.class);

    @FunctionalInterface
    public interface LookupEmails {
        Map<String, String> lookup(List<String> userIds);
    }

    @FunctionalInterface
    public interface HttpPoster {
        int post(String url, Map<String, String> headers, String body) throws Exception;
    }

    private final ObjectMapper objectMapper;
    private final HttpPoster httpPoster;
    private final String webhookUrlOverride;
    private final String webhookSecretOverride;

    public ConnectionNotifier(HttpClient httpClient, ObjectMapper objectMapper) {
        this(defaultPoster(httpClient), objectMapper, null, null);
    }

    public ConnectionNotifier(HttpPoster httpPoster, ObjectMapper objectMapper) {
        this(httpPoster, objectMapper, null, null);
    }

    public ConnectionNotifier(
            HttpPoster httpPoster,
            ObjectMapper objectMapper,
            String webhookUrlOverride,
            String webhookSecretOverride) {
        this.objectMapper = objectMapper == null ? new ObjectMapper() : objectMapper;
        this.httpPoster = httpPoster;
        this.webhookUrlOverride = webhookUrlOverride;
        this.webhookSecretOverride = webhookSecretOverride;
    }

    private static HttpPoster defaultPoster(HttpClient httpClient) {
        HttpClient client =
                httpClient == null
                        ? HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
                        : httpClient;
        return (url, headers, body) -> {
            HttpRequest.Builder builder =
                    HttpRequest.newBuilder(URI.create(url))
                            .timeout(Duration.ofSeconds(10))
                            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
            headers.forEach(builder::header);
            HttpResponse<String> response =
                    client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return response.statusCode();
        };
    }

    public static Map<String, String> buildConnectionReadyEmail(String orderCode) {
        String code = orderCode == null ? "" : orderCode.trim();
        String subject = "SharingBridge — order " + code + " connection ready";
        String text =
                "Order "
                        + code
                        + " — a connection is ready. Open SharingBridge and go to Actions → this order.\n\n"
                        + "We do not send payment links or QR codes by email. Confirm the order code in the app before paying anyone.";
        Map<String, String> out = new LinkedHashMap<>();
        out.put("subject", subject);
        out.put("text", text);
        return out;
    }

    public Map<String, Object> notifyConnectionReady(
            String orderCode, List<String> recipientUserIds, LookupEmails lookupEmails) {
        String trimmed = orderCode == null ? "" : orderCode.trim();
        if (trimmed.isEmpty()) {
            return Map.of("sent", false, "reason", "missing_order_code");
        }
        String webhook =
                firstNonBlank(webhookUrlOverride, env("CONNECTION_NOTIFY_WEBHOOK_URL"));
        List<String> ids = recipientUserIds == null ? List.of() : recipientUserIds;
        Map<String, String> emailByUserId =
                lookupEmails == null ? Map.of() : lookupEmails.lookup(ids);
        Set<String> uniqueEmails = new LinkedHashSet<>();
        for (String id : ids) {
            String email = emailByUserId.get(id);
            if (email instanceof String text && !text.trim().isEmpty()) {
                uniqueEmails.add(email);
            } else if (email != null && !String.valueOf(email).trim().isEmpty()) {
                uniqueEmails.add(String.valueOf(email).trim());
            }
        }
        List<String> recipientEmails = new ArrayList<>(uniqueEmails);
        Map<String, String> email = buildConnectionReadyEmail(trimmed);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "connection_ready");
        payload.put("order_code", trimmed);
        payload.put("recipient_user_ids", ids);
        payload.put("recipient_emails", recipientEmails);
        payload.put("subject", email.get("subject"));
        payload.put("text", email.get("text"));

        if (webhook == null || webhook.isEmpty()) {
            log.info(
                    "[connection-notify] order {} ready — {} recipient(s); set CONNECTION_NOTIFY_WEBHOOK_URL to deliver push/email",
                    trimmed,
                    ids.size());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sent", false);
            result.put("reason", "webhook_not_configured");
            result.put("recipient_count", ids.size());
            return result;
        }

        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("content-type", "application/json");
        String secret =
                firstNonBlank(webhookSecretOverride, env("CONNECTION_NOTIFY_WEBHOOK_SECRET"));
        if (secret != null && !secret.isEmpty()) {
            headers.put("x-webhook-secret", secret);
        }

        try {
            String body = objectMapper.writeValueAsString(payload);
            int status = httpPoster.post(webhook, headers, body);
            if (status < 200 || status >= 300) {
                log.warn("[connection-notify] webhook HTTP {} for order {}", status, trimmed);
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("sent", false);
                result.put("reason", "webhook_failed");
                result.put("status", status);
                return result;
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sent", true);
            result.put("recipient_count", recipientEmails.size());
            return result;
        } catch (Exception ex) {
            log.warn("[connection-notify] webhook failed for order {}: {}", trimmed, ex.getMessage());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sent", false);
            result.put("reason", "webhook_failed");
            return result;
        }
    }

    private static String env(String name) {
        String raw = System.getenv(name);
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    private static String firstNonBlank(String override, String fallback) {
        if (override != null && !override.isBlank()) {
            return override.trim();
        }
        return fallback;
    }
}
