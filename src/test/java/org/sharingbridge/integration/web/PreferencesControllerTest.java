package org.sharingbridge.integration.web;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.config.AuthConfig;
import org.sharingbridge.integration.service.PreferencesService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PreferencesController.class)
@Import({AuthConfig.class, ApiExceptionHandler.class})
class PreferencesControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private PreferencesService preferencesService;

    @Test
    void getPreferencesRequiresAuth() throws Exception {
        mockMvc.perform(get("/v1/donor-setup/preferences"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("missing_auth_context"));
    }

    @Test
    void getPreferencesReturnsPresets() throws Exception {
        String token = jwtService.mint("user-1");
        when(preferencesService.list(eq("user-1"), anyString()))
                .thenReturn(Map.of("user_id", "user-1", "presets", List.of()));

        mockMvc.perform(get("/v1/donor-setup/preferences")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user_id").value("user-1"))
                .andExpect(jsonPath("$.presets").isArray());
    }

    @Test
    void deletePreferencesClears() throws Exception {
        String token = jwtService.mint("user-1");
        when(preferencesService.clear(eq("user-1"), anyString()))
                .thenReturn(Map.of("user_id", "user-1", "presets", List.of(), "cleared", true));

        mockMvc.perform(delete("/v1/donor-setup/preferences")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cleared").value(true));
    }

    @Test
    void postPreferencesRejectsUserMismatch() throws Exception {
        String token = jwtService.mint("user-1");
        mockMvc.perform(post("/v1/donor-setup/preferences")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"user_id\":\"other\",\"presets\":[]}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("user_id_mismatch"));
    }
}
