package org.sharingbridge.integration.web;

import java.util.Map;
import java.util.Optional;
import org.sharingbridge.integration.auth.AuthContext;
import org.sharingbridge.integration.auth.AuthSupport;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.auth.Roles;
import org.sharingbridge.integration.service.SeekerDemandService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SeekerDemandController {

    private final SeekerDemandService seekerDemandService;
    private final JwtService jwtService;

    public SeekerDemandController(SeekerDemandService seekerDemandService, JwtService jwtService) {
        this.seekerDemandService = seekerDemandService;
        this.jwtService = jwtService;
    }

    @GetMapping("/v1/seeker-demands")
    public ResponseEntity<?> list(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        if (auth == null) {
            return missingAuth();
        }
        return ResponseEntity.ok(seekerDemandService.list(auth.userId(), auth.role()));
    }

    @PostMapping("/v1/seeker-demands")
    public ResponseEntity<?> create(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) Map<String, Object> payload) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        Optional<AuthSupport.AuthError> reporterGuard = AuthSupport.requireReporter(auth);
        if (reporterGuard.isPresent()) {
            AuthSupport.AuthError error = reporterGuard.get();
            return ResponseEntity.status(error.status()).body(error.body());
        }
        Map<String, Object> body = seekerDemandService.create(auth.userId(), payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PatchMapping("/v1/seeker-demands/{id}")
    public ResponseEntity<?> patch(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable("id") String id,
            @RequestBody(required = false) Map<String, Object> payload) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        if (auth == null) {
            return missingAuth();
        }
        if (!Roles.isCoordinatorApiRole(auth.role())) {
            return ResponseEntity.status(403)
                    .body(Map.of(
                            "code",
                            "forbidden",
                            "message",
                            "Coordinator role required to update seeker demand delivery."));
        }
        return ResponseEntity.ok(seekerDemandService.patch(id, payload));
    }

    private static ResponseEntity<Map<String, Object>> missingAuth() {
        return ResponseEntity.status(401)
                .body(Map.of(
                        "code",
                        "missing_auth_context",
                        "message",
                        "A valid Bearer token is required."));
    }
}
