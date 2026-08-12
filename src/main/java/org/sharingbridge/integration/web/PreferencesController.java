package org.sharingbridge.integration.web;

import java.util.Map;
import org.sharingbridge.integration.auth.AuthContext;
import org.sharingbridge.integration.auth.AuthSupport;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.service.PreferencesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PreferencesController {

    private final PreferencesService preferencesService;
    private final JwtService jwtService;

    public PreferencesController(PreferencesService preferencesService, JwtService jwtService) {
        this.preferencesService = preferencesService;
        this.jwtService = jwtService;
    }

    @GetMapping("/v1/donor-setup/preferences")
    public ResponseEntity<?> list(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(value = "user_id", required = false) String queryUserId) {
        AuthResult auth = authenticate(authorization, queryUserId);
        if (auth.error() != null) {
            return ResponseEntity.status(auth.error().status()).body(auth.error().body());
        }
        return ResponseEntity.ok(preferencesService.list(auth.userId(), authorization));
    }

    @PostMapping("/v1/donor-setup/preferences")
    public ResponseEntity<?> save(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> payload) {
        Object supplied = payload == null ? null : payload.get("user_id");
        AuthResult auth = authenticate(
                authorization, supplied instanceof String s ? s : null);
        if (auth.error() != null) {
            return ResponseEntity.status(auth.error().status()).body(auth.error().body());
        }
        Map<String, Object> body =
                payload == null ? new java.util.LinkedHashMap<>() : new java.util.LinkedHashMap<>(payload);
        body.put("user_id", auth.userId());
        return ResponseEntity.ok(preferencesService.save(auth.userId(), body, authorization));
    }

    @DeleteMapping("/v1/donor-setup/preferences")
    public ResponseEntity<?> clear(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(value = "user_id", required = false) String queryUserId) {
        AuthResult auth = authenticate(authorization, queryUserId);
        if (auth.error() != null) {
            return ResponseEntity.status(auth.error().status()).body(auth.error().body());
        }
        return ResponseEntity.ok(preferencesService.clear(auth.userId(), authorization));
    }

    @PostMapping("/v1/donor-setup/preferences/delete-item")
    public ResponseEntity<?> deleteItem(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> payload) {
        Object supplied = payload == null ? null : payload.get("user_id");
        AuthResult auth = authenticate(
                authorization, supplied instanceof String s ? s : null);
        if (auth.error() != null) {
            return ResponseEntity.status(auth.error().status()).body(auth.error().body());
        }
        return ResponseEntity.ok(
                preferencesService.deleteItem(
                        auth.userId(), payload == null ? Map.of() : payload, authorization));
    }

    private AuthResult authenticate(String authorization, String suppliedUserId) {
        AuthContext auth =
                AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        String headerUserId = auth == null ? null : auth.userId();
        AuthSupport.ResolvedUserId resolved =
                AuthSupport.resolveAuthenticatedUserId(headerUserId, suppliedUserId);
        if (resolved.error() != null) {
            return new AuthResult(null, resolved.error());
        }
        return new AuthResult(resolved.userId(), null);
    }

    private record AuthResult(String userId, AuthSupport.AuthError error) {}
}
