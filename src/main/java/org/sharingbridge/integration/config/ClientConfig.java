package org.sharingbridge.integration.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.time.Duration;
import org.sharingbridge.integration.client.AiOrchestrationClient;
import org.sharingbridge.integration.client.AiOrchestrationProperties;
import org.sharingbridge.integration.client.NominatimClient;
import org.sharingbridge.integration.client.UserServicePreferencesClient;
import org.sharingbridge.integration.service.ConnectionNotifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClientConfig {

    @Bean
    public AiOrchestrationProperties aiOrchestrationProperties() {
        return AiOrchestrationProperties.fromEnvironment();
    }

    @Bean
    public AiOrchestrationClient aiOrchestrationClient(AiOrchestrationProperties properties) {
        return new AiOrchestrationClient(properties);
    }

    @Bean
    public NominatimClient nominatimClient() {
        return new NominatimClient();
    }

    @Bean
    public UserServicePreferencesClient userServicePreferencesClient() {
        String baseUrl = System.getenv("USER_SERVICE_BASE_URL");
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalStateException(
                    "USER_SERVICE_BASE_URL is required. Donor presets are stored via user-service.");
        }
        return new UserServicePreferencesClient(baseUrl.trim());
    }

    @Bean
    public HttpClient connectionNotifyHttpClient() {
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @Bean
    public ConnectionNotifier connectionNotifier(
            HttpClient connectionNotifyHttpClient, ObjectMapper objectMapper) {
        return new ConnectionNotifier(connectionNotifyHttpClient, objectMapper);
    }
}
