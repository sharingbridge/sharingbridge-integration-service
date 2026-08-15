package org.sharingbridge.integration.web;

import java.util.Map;
import java.util.Optional;
import org.sharingbridge.integration.auth.AuthContext;
import org.sharingbridge.integration.auth.AuthSupport;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.service.OrderIntentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OrderIntentController {

    private final OrderIntentService orderIntentService;
    private final JwtService jwtService;

    public OrderIntentController(OrderIntentService orderIntentService, JwtService jwtService) {
        this.orderIntentService = orderIntentService;
        this.jwtService = jwtService;
    }

    @GetMapping("/v1/donor-seeker/order-intents")
    public ResponseEntity<?> list(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(value = "user_id", required = false) String queryUserId,
            @RequestParam(value = "since", required = false) String since,
            @RequestParam(value = "near_lat", required = false) String nearLat,
            @RequestParam(value = "near_lng", required = false) String nearLng,
            @RequestParam(value = "locality_key", required = false) String localityKey,
            @RequestParam(value = "radius_m", required = false) String radiusM) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        if (auth == null) {
            return missingAuth();
        }
        return ResponseEntity.ok(
                orderIntentService.list(
                        auth.userId(),
                        auth.role(),
                        queryUserId,
                        since,
                        nearLat,
                        nearLng,
                        localityKey,
                        radiusM));
    }

    @PostMapping("/v1/donor-seeker/order-intents")
    public ResponseEntity<?> create(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) Map<String, Object> payload) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        Optional<AuthSupport.AuthError> donorGuard = AuthSupport.requireInitiator(auth);
        if (donorGuard.isPresent()) {
            AuthSupport.AuthError error = donorGuard.get();
            return ResponseEntity.status(error.status()).body(error.body());
        }
        Map<String, Object> body = payload == null ? Map.of() : payload;
        String headerUserId = auth.userId();
        String suppliedUserId =
                body.get("user_id") instanceof String text ? text.trim() : "";
        String userId =
                headerUserId != null && !headerUserId.isBlank()
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
        if (userId == null) {
            return ResponseEntity.status(400)
                    .body(Map.of(
                            "code",
                            "invalid_request",
                            "message",
                            "user_id is required when no Bearer token is supplied."));
        }
        return orderIntentService.create(userId, body);
    }

    @PatchMapping("/v1/donor-seeker/order-intents/{id}")
    public ResponseEntity<?> patch(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable("id") String id,
            @RequestBody(required = false) Map<String, Object> payload) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        if (auth == null) {
            return missingAuth();
        }
        if (!org.sharingbridge.integration.auth.Roles.isCoordinatorApiRole(auth.role())) {
            Optional<AuthSupport.AuthError> donorGuard = AuthSupport.requireInitiator(auth);
            if (donorGuard.isPresent()) {
                AuthSupport.AuthError error = donorGuard.get();
                return ResponseEntity.status(error.status()).body(error.body());
            }
        }
        return ResponseEntity.ok(orderIntentService.patch(auth.userId(), auth.role(), id, payload));
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
