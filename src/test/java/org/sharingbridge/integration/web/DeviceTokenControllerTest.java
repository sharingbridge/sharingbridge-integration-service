package org.sharingbridge.integration.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.config.AuthConfig;
import org.sharingbridge.integration.service.DeviceTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = DeviceTokenController.class)
@Import({AuthConfig.class, ApiExceptionHandler.class})
class DeviceTokenControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private DeviceTokenService deviceTokenService;

    @Test
    void requiresBearer() throws Exception {
        mockMvc.perform(put("/v1/device-tokens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fcm_token\":\"abc\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("missing_auth_context"));
    }

    @Test
    void upsertsToken() throws Exception {
        String token = jwtService.mint("user-1");
        when(deviceTokenService.upsert(eq("user-1"), any()))
                .thenReturn(Map.of(
                        "device_token",
                        Map.of(
                                "user_id",
                                "user-1",
                                "platform",
                                "android",
                                "updated_at",
                                "2026-01-01T00:00:00Z")));

        mockMvc.perform(put("/v1/device-tokens")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fcm_token\":\"abc\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.device_token.user_id").value("user-1"))
                .andExpect(jsonPath("$.device_token.platform").value("android"));
    }
}
