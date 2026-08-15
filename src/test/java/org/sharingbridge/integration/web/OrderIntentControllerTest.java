package org.sharingbridge.integration.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.config.AuthConfig;
import org.sharingbridge.integration.service.OrderIntentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = OrderIntentController.class)
@Import({AuthConfig.class, ApiExceptionHandler.class})
class OrderIntentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private OrderIntentService orderIntentService;

    @Test
    void listRequiresBearer() throws Exception {
        mockMvc.perform(get("/v1/donor-seeker/order-intents"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("missing_auth_context"));
    }

    @Test
    void createRequiresInitiatorRole() throws Exception {
        String token = jwtService.mint("coord-1", Map.of("role", "coordinator"));
        mockMvc.perform(post("/v1/donor-seeker/order-intents")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pack_id\":\"p1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    void createReturnsCreated() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        when(orderIntentService.create(eq("alice"), any()))
                .thenReturn(ResponseEntity.status(201)
                        .body(Map.of(
                                "order_intent_id",
                                "oi-1",
                                "user_id",
                                "alice",
                                "pack_id",
                                "pack-test-1",
                                "status",
                                "instructions_copied",
                                "created",
                                true)));
        mockMvc.perform(post("/v1/donor-seeker/order-intents")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pack_id\":\"pack-test-1\",\"status\":\"instructions_copied\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.order_intent_id").value("oi-1"))
                .andExpect(jsonPath("$.created").value(true));
    }

    @Test
    void listReturnsCoordinatorDashboard() throws Exception {
        String token = jwtService.mint("coord-1", Map.of("role", "coordinator"));
        when(orderIntentService.list(eq("coord-1"), eq("coordinator"), any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of(
                        "user_id",
                        "coord-1",
                        "role",
                        "coordinator",
                        "dashboard",
                        "coordinator",
                        "order_intents",
                        List.of(Map.of(
                                "order_intent_id",
                                "oi-1",
                                "donor_email",
                                "alice@example.com",
                                "initiator_email",
                                "alice@example.com",
                                "location_lat",
                                12.97,
                                "has_reference_photo",
                                true,
                                "reference_photo_view_url",
                                "https://cdn/view"))));
        mockMvc.perform(get("/v1/donor-seeker/order-intents")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dashboard").value("coordinator"))
                .andExpect(jsonPath("$.order_intents[0].donor_email").value("alice@example.com"))
                .andExpect(jsonPath("$.order_intents[0].reference_photo_view_url").value("https://cdn/view"));
    }

    @Test
    void listReturnsLimitedInitiatorDashboard() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        java.util.Map<String, Object> intent = new java.util.LinkedHashMap<>();
        intent.put("order_intent_id", "oi-bob");
        intent.put("location_lat", null);
        intent.put("has_reference_photo", false);
        intent.put("reference_photo_view_url", "");
        when(orderIntentService.list(eq("alice"), eq("initiator"), any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of(
                        "user_id",
                        "alice",
                        "role",
                        "initiator",
                        "dashboard",
                        "limited",
                        "order_intents",
                        java.util.List.of(intent)));
        mockMvc.perform(get("/v1/donor-seeker/order-intents")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dashboard").value("limited"))
                .andExpect(jsonPath("$.order_intents[0].has_reference_photo").value(false))
                .andExpect(jsonPath("$.order_intents[0].reference_photo_view_url").value(""));
    }

    @Test
    void patchLetsInitiatorMarkPayment() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        when(orderIntentService.patch(eq("alice"), eq("initiator"), eq("oi-1"), any()))
                .thenReturn(Map.of("order_intent", Map.of("order_intent_id", "oi-1", "payment_status", "paid_externally")));
        mockMvc.perform(patch("/v1/donor-seeker/order-intents/oi-1")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"payment_status\":\"paid_externally\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order_intent.payment_status").value("paid_externally"));
    }

    @Test
    void patchLetsCoordinatorMarkDelivered() throws Exception {
        String token = jwtService.mint("coord-1", Map.of("role", "coordinator"));
        when(orderIntentService.patch(eq("coord-1"), eq("coordinator"), eq("oi-1"), any()))
                .thenReturn(Map.of(
                        "order_intent",
                        Map.of(
                                "order_intent_id",
                                "oi-1",
                                "delivery_status",
                                "delivered",
                                "delivered_at",
                                "2026-06-05T12:00:00Z")));
        mockMvc.perform(patch("/v1/donor-seeker/order-intents/oi-1")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"delivery_status\":\"delivered\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order_intent.delivery_status").value("delivered"));
    }
}
