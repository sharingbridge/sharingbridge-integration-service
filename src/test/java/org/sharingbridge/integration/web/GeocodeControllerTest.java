package org.sharingbridge.integration.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.config.AuthConfig;
import org.sharingbridge.integration.service.PostalGeocodeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = GeocodeController.class)
@Import({AuthConfig.class, ApiExceptionHandler.class})
class GeocodeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private PostalGeocodeService postalGeocodeService;

    @Test
    void requiresBearer() throws Exception {
        mockMvc.perform(get("/v1/geocode/reverse")
                        .param("location_lat", "12.94")
                        .param("location_lng", "80.24"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("missing_auth_context"));
    }

    @Test
    void validatesCoordinates() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "donor"));
        mockMvc.perform(get("/v1/geocode/reverse")
                        .header("Authorization", "Bearer " + token)
                        .param("location_lat", "not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_coordinates"));
    }

    @Test
    void validatesCoordinateRange() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "donor"));
        mockMvc.perform(get("/v1/geocode/reverse")
                        .header("Authorization", "Bearer " + token)
                        .param("location_lat", "91")
                        .param("location_lng", "80.24"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_coordinates"));
    }

    @Test
    void returnsReverseGeocodeForAnyRole() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "donor"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("location_lat", 12.94);
        result.put("location_lng", 80.24);
        result.put("locality_key", "IN:TN:600115");
        result.put("formatted_address", "Adyar, Chennai");
        when(postalGeocodeService.reverseGeocodeLocation(eq(12.94), eq(80.24))).thenReturn(result);

        mockMvc.perform(get("/v1/geocode/reverse")
                        .header("Authorization", "Bearer " + token)
                        .param("location_lat", "12.94")
                        .param("location_lng", "80.24"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user_id").value("alice"))
                .andExpect(jsonPath("$.location_lat").value(12.94))
                .andExpect(jsonPath("$.location_lng").value(80.24))
                .andExpect(jsonPath("$.locality_key").value("IN:TN:600115"))
                .andExpect(jsonPath("$.formatted_address").value("Adyar, Chennai"));
    }

    @Test
    void returns502WhenUpstreamUnavailable() throws Exception {
        String token = jwtService.mint("alice", Map.of("role", "donor"));
        when(postalGeocodeService.reverseGeocodeLocation(eq(12.94), eq(80.24))).thenReturn(null);

        mockMvc.perform(get("/v1/geocode/reverse")
                        .header("Authorization", "Bearer " + token)
                        .param("location_lat", "12.94")
                        .param("location_lng", "80.24"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("reverse_geocode_unavailable"));
    }
}
