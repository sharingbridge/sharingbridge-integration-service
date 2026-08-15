package org.sharingbridge.integration.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.config.AuthConfig;
import org.sharingbridge.integration.service.MarketplaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = MarketplaceController.class)
@Import({AuthConfig.class, ApiExceptionHandler.class})
class MarketplaceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private MarketplaceService marketplaceService;

    @Test
    void pledgesAllowCoordinator() throws Exception {
        String token = jwtService.mint("coord-1", Map.of("role", "coordinator"));
        when(marketplaceService.createPledge(eq("coord-1"), any()))
                .thenReturn(Map.of("pledge", Map.of("pledge_id", "pl-1", "meal_units", 2)));
        mockMvc.perform(post("/v1/pledges")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"locality_key\":\"IN:TN:600115\",\"standard_offer_id\":\"so-lunch-full\",\"email_share_consent\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pledge.pledge_id").value("pl-1"));
    }

    @Test
    void vendorBidsRequireCoordinator() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        mockMvc.perform(post("/v1/vendor-bids")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"locality_key\":\"IN:TN:600115\",\"standard_offer_id\":\"so-lunch-full\",\"vendor_name\":\"A2B\",\"portions\":10,\"email_share_consent\":true}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Coordinator role required to submit vendor bids (MVP)."));
    }

    @Test
    void vendorBidsSucceedForCoordinator() throws Exception {
        String token = jwtService.mint("coord-1", Map.of("role", "coordinator"));
        when(marketplaceService.createVendorBid(eq("coord-1"), any()))
                .thenReturn(Map.of("vendor_bid", Map.of("vendor_bid_id", "vb-1", "vendor_name", "A2B Kitchen")));
        mockMvc.perform(post("/v1/vendor-bids")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"locality_key\":\"IN:TN:600115\",\"standard_offer_id\":\"so-lunch-full\",\"vendor_name\":\"A2B Kitchen\",\"portions\":20,\"email_share_consent\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.vendor_bid.vendor_name").value("A2B Kitchen"));
    }

    @Test
    void pledgesReturn503WhenStoreDisabled() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "initiator"));
        when(marketplaceService.createPledge(eq("alice"), any()))
                .thenThrow(new ApiException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "marketplace_unavailable",
                        "Marketplace store is not configured."));
        mockMvc.perform(post("/v1/pledges")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"locality_key\":\"IN:TN:600115\",\"standard_offer_id\":\"so-lunch-full\",\"email_share_consent\":true}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("marketplace_unavailable"));
    }
}
