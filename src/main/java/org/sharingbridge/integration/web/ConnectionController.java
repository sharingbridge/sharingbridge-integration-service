package org.sharingbridge.integration.web;

import java.util.Map;
import org.sharingbridge.integration.auth.AuthContext;
import org.sharingbridge.integration.auth.AuthSupport;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.service.ConnectionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ConnectionController {

    private final ConnectionService connectionService;
    private final JwtService jwtService;

    public ConnectionController(ConnectionService connectionService, JwtService jwtService) {
        this.connectionService = connectionService;
        this.jwtService = jwtService;
    }

    @GetMapping("/v1/connections/{orderCode}")
    public ResponseEntity<?> get(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable("orderCode") String orderCode) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        if (auth == null) {
            return ResponseEntity.status(401)
                    .body(Map.of(
                            "code",
                            "missing_auth_context",
                            "message",
                            "A valid Bearer token is required."));
        }
        return ResponseEntity.ok(connectionService.resolve(orderCode, auth.userId(), auth.role()));
    }
}
