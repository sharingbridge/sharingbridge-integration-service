package org.sharingbridge.integration.web;

import java.util.Map;
import java.util.Optional;
import org.sharingbridge.integration.auth.AuthContext;
import org.sharingbridge.integration.auth.AuthSupport;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.service.InstructionPackService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InstructionPackController {

    private final InstructionPackService instructionPackService;
    private final JwtService jwtService;

    public InstructionPackController(
            InstructionPackService instructionPackService, JwtService jwtService) {
        this.instructionPackService = instructionPackService;
        this.jwtService = jwtService;
    }

    @PostMapping("/v1/donor-seeker/instruction-pack")
    public ResponseEntity<?> instructionPack(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) Map<String, Object> payload) {
        AuthContext auth =
                AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        Optional<AuthSupport.AuthError> donorGuard = AuthSupport.requireInitiator(auth);
        if (donorGuard.isPresent()) {
            AuthSupport.AuthError error = donorGuard.get();
            return ResponseEntity.status(error.status()).body(error.body());
        }
        String headerUserId = auth.userId();
        String suppliedUserId = "";
        if (payload != null && payload.get("user_id") instanceof String s) {
            suppliedUserId = s.trim();
        }
        String userId = headerUserId != null && !headerUserId.isBlank()
                ? headerUserId
                : (suppliedUserId.isEmpty() ? null : suppliedUserId);
        if (headerUserId != null
                && !headerUserId.isBlank()
                && !suppliedUserId.isEmpty()
                && !headerUserId.equals(suppliedUserId)) {
            return ResponseEntity.status(403)
                    .body(Map.of(
                            "code",
                            "user_id_mismatch",
                            "message",
                            "user_id in payload does not match the authenticated user_id."));
        }
        return ResponseEntity.ok(
                instructionPackService.build(payload == null ? Map.of() : payload, userId));
    }
}
