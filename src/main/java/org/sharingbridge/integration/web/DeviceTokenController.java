package org.sharingbridge.integration.web;

import java.util.Map;
import org.sharingbridge.integration.auth.AuthContext;
import org.sharingbridge.integration.auth.AuthSupport;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.service.DeviceTokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DeviceTokenController {

    private final DeviceTokenService deviceTokenService;
    private final JwtService jwtService;

    public DeviceTokenController(DeviceTokenService deviceTokenService, JwtService jwtService) {
        this.deviceTokenService = deviceTokenService;
        this.jwtService = jwtService;
    }

    @PutMapping("/v1/device-tokens")
    public ResponseEntity<?> upsert(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) Map<String, Object> payload) {
        AuthContext auth =
                AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        if (auth == null) {
            return ResponseEntity.status(401)
                    .body(Map.of(
                            "code",
                            "missing_auth_context",
                            "message",
                            "A valid Bearer token is required."));
        }
        return ResponseEntity.ok(
                deviceTokenService.upsert(auth.userId(), payload == null ? Map.of() : payload));
    }
}
