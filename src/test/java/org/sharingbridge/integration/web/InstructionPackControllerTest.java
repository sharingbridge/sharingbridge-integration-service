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
import org.sharingbridge.integration.service.InstructionPackService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = InstructionPackController.class)
@Import({AuthConfig.class, ApiExceptionHandler.class})
class InstructionPackControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private InstructionPackService instructionPackService;

    @Test
    void requiresInitiatorRole() throws Exception {
        String token = jwtService.mint("coord-1", Map.of("role", "coordinator"));
        mockMvc.perform(post("/v1/donor-seeker/instruction-pack")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    void returnsPackForInitiator() throws Exception {
        String token = jwtService.mint("user-1", Map.of("role", "initiator"));
        when(instructionPackService.build(any(), eq("user-1")))
                .thenReturn(Map.of(
                        "user_id",
                        "user-1",
                        "pack_id",
                        "p1",
                        "delivery_instructions",
                        "leave at gate",
                        "source",
                        "orchestration"));

        mockMvc.perform(post("/v1/donor-seeker/instruction-pack")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pack_id").value("p1"))
                .andExpect(jsonPath("$.user_id").value("user-1"));
    }
}
