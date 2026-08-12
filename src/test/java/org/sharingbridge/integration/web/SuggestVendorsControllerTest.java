package org.sharingbridge.integration.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.service.AiServiceUnavailableException;
import org.sharingbridge.integration.service.SuggestVendorsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = SuggestVendorsController.class)
@Import(ApiExceptionHandler.class)
class SuggestVendorsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SuggestVendorsService suggestVendorsService;

    @Test
    void returnsSuggestionsWithoutAuth() throws Exception {
        when(suggestVendorsService.suggest(any()))
                .thenReturn(Map.of(
                        "suggestions",
                        List.of(),
                        "generated_at",
                        "2026-01-01T00:00:00Z",
                        "source",
                        "orchestration"));

        mockMvc.perform(post("/v1/donor-setup/suggest-vendors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query_text\":\"dosa\",\"location_precision\":\"city\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("orchestration"));
    }

    @Test
    void returns503WhenAiUnavailable() throws Exception {
        when(suggestVendorsService.suggest(any()))
                .thenThrow(new AiServiceUnavailableException("down", "ai_disabled"));

        mockMvc.perform(post("/v1/donor-setup/suggest-vendors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query_text\":\"dosa\",\"location_precision\":\"city\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("ai_disabled"));
    }
}
