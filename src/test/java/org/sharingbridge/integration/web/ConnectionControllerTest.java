package org.sharingbridge.integration.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.config.AuthConfig;
import org.sharingbridge.integration.service.ConnectionHandoff;
import org.sharingbridge.integration.service.ConnectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = ConnectionController.class)
@Import({AuthConfig.class, ApiExceptionHandler.class})
class ConnectionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private ConnectionService connectionService;

    @Test
    void requiresBearer() throws Exception {
        mockMvc.perform(get("/v1/connections/SB-7K2M-9F3"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("missing_auth_context"));
    }

    @Test
    void returns403IfNotParty() throws Exception {
        String token = jwtService.mint("bob", Map.of("role", "initiator"));
        when(connectionService.resolve(eq("SB-7K2M-9F3"), eq("bob"), eq("initiator")))
                .thenThrow(ConnectionHandoff.forbidden());
        mockMvc.perform(get("/v1/connections/SB-7K2M-9F3")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("connection_forbidden"));
    }

    @Test
    void returnsReadySafetyCopy() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        when(connectionService.resolve(eq("SB-7K2M-9F3"), eq("alice"), eq("initiator")))
                .thenReturn(Map.of(
                        "connection",
                        Map.of(
                                "order_code",
                                "SB-7K2M-9F3",
                                "status",
                                "ready",
                                "safety_copy",
                                ConnectionHandoff.CONNECTION_SAFETY_COPY,
                                "kitchen",
                                Map.of("display_name", "Green Kitchen", "login_email", "k@example.com"))));
        mockMvc.perform(get("/v1/connections/SB-7K2M-9F3")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connection.status").value("ready"))
                .andExpect(jsonPath("$.connection.safety_copy").value(ConnectionHandoff.CONNECTION_SAFETY_COPY));
    }

    @Test
    void returnsPendingKitchenSafetyCopy() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        java.util.Map<String, Object> connection = new java.util.LinkedHashMap<>();
        connection.put("order_code", "SB-7K2M-9F3");
        connection.put("status", "pending_kitchen");
        connection.put("safety_copy", ConnectionHandoff.CONNECTION_SAFETY_COPY);
        connection.put("kitchen", null);
        when(connectionService.resolve(eq("SB-7K2M-9F3"), eq("alice"), eq("initiator")))
                .thenReturn(Map.of("connection", connection));
        mockMvc.perform(get("/v1/connections/SB-7K2M-9F3")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connection.status").value("pending_kitchen"))
                .andExpect(jsonPath("$.connection.safety_copy").value(ConnectionHandoff.CONNECTION_SAFETY_COPY))
                .andExpect(jsonPath("$.connection.kitchen").value(org.hamcrest.Matchers.nullValue()));
    }
}
