package org.sharingbridge.integration.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.config.AuthConfig;
import org.sharingbridge.integration.service.SeekerDemandService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = SeekerDemandController.class)
@Import({AuthConfig.class, ApiExceptionHandler.class})
class SeekerDemandControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private SeekerDemandService seekerDemandService;

    @Test
    void listRequiresBearer() throws Exception {
        mockMvc.perform(get("/v1/seeker-demands"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("missing_auth_context"));
    }

    @Test
    void createRequiresConsentAndReturnsCreated() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        when(seekerDemandService.create(eq("alice"), any()))
                .thenReturn(Map.of(
                        "user_id",
                        "alice",
                        "created",
                        true,
                        "seeker_demand",
                        Map.of("seeker_demand_id", "sd-1", "initiation_route", "eco_kitchen_pledge")));
        mockMvc.perform(post("/v1/seeker-demands")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"standard_offer_id\":\"so-lunch-full\",\"meal_units\":2,\"email_share_consent\":true,\"location_lat\":12.94,\"location_lng\":80.23,\"locality_key\":\"IN:TN:600115\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.created").value(true));
    }

    @Test
    void createRejectsMissingConsentViaApiException() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        when(seekerDemandService.create(eq("alice"), any()))
                .thenThrow(new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "invalid_request",
                        "email_share_consent must be true — login email may be shared with the eco kitchen for off-platform coordination."));
        mockMvc.perform(post("/v1/seeker-demands")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"standard_offer_id\":\"so-lunch-full\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_request"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("email_share_consent")));
    }

    @Test
    void patchRequiresCoordinator() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        mockMvc.perform(patch("/v1/seeker-demands/sd-1")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"delivery_status\":\"delivered\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message")
                        .value("Coordinator role required to update seeker demand delivery."));
    }

    @Test
    void coordinatorCanPatch() throws Exception {
        String token = jwtService.mint("coord-1", Map.of("role", "coordinator"));
        when(seekerDemandService.patch(eq("sd-1"), any()))
                .thenReturn(Map.of("seeker_demand", Map.of("seeker_demand_id", "sd-1", "status", "fulfilled")));
        mockMvc.perform(patch("/v1/seeker-demands/sd-1")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"delivery_status\":\"delivered\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seeker_demand.status").value("fulfilled"));
    }
}
