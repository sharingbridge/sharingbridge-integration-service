package org.sharingbridge.integration.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;

class UserServicePreferencesClientTest {

    @Test
    @SuppressWarnings("unchecked")
    void listByUserForwardsAuthorizationAndParsesPresets() throws Exception {
        HttpClient httpClient = Mockito.mock(HttpClient.class);
        HttpResponse<String> response = Mockito.mock(HttpResponse.class);
        Mockito.when(response.statusCode()).thenReturn(200);
        Mockito.when(response.body()).thenReturn("{\"presets\":[{\"restaurant_name\":\"A\"}]}");
        AtomicReference<HttpRequest> captured = new AtomicReference<>();
        Mockito.when(httpClient.send(
                        ArgumentMatchers.any(HttpRequest.class),
                        ArgumentMatchers.any(HttpResponse.BodyHandler.class)))
                .thenAnswer(invocation -> {
                    captured.set(invocation.getArgument(0));
                    return response;
                });

        UserServicePreferencesClient client =
                new UserServicePreferencesClient("https://users.example.com", httpClient, new com.fasterxml.jackson.databind.ObjectMapper());
        List<Map<String, Object>> presets = client.listByUser("user 1", "Bearer tok");

        assertEquals(1, presets.size());
        assertEquals("A", presets.get(0).get("restaurant_name"));
        HttpRequest request = captured.get();
        assertTrue(request.uri().toString().contains("/v1/users/user%201/donor-presets"));
        assertEquals("Bearer tok", request.headers().firstValue("authorization").orElse(null));
    }
}
