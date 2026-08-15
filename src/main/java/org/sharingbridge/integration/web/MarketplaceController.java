package org.sharingbridge.integration.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.sharingbridge.integration.auth.AuthContext;
import org.sharingbridge.integration.auth.AuthSupport;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.auth.Roles;
import org.sharingbridge.integration.service.MarketplaceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MarketplaceController {

    private final MarketplaceService marketplaceService;
    private final JwtService jwtService;

    public MarketplaceController(MarketplaceService marketplaceService, JwtService jwtService) {
        this.marketplaceService = marketplaceService;
        this.jwtService = jwtService;
    }

    @GetMapping("/v1/standard-offers")
    public ResponseEntity<?> standardOffers(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(value = "locality_key", required = false) String localityKey,
            @RequestParam(value = "location_lat", required = false) String lat,
            @RequestParam(value = "location_lng", required = false) String lng) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        if (auth == null) {
            return missingAuth();
        }
        return ResponseEntity.ok(
                marketplaceService.listStandardOffers(auth.userId(), localityKey, lat, lng));
    }

    @GetMapping("/v1/demand/board")
    public ResponseEntity<?> demandBoard(
            @RequestHeader(value = "Authorization", required = false) String authorization,
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
                marketplaceService.demandBoard(
                        auth.role(), since, nearLat, nearLng, localityKey, radiusM));
    }

    @PostMapping("/v1/pledges")
    public ResponseEntity<?> pledges(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) Map<String, Object> payload) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        Optional<AuthSupport.AuthError> reporterGuard = AuthSupport.requireReporter(auth);
        if (reporterGuard.isPresent()) {
            AuthSupport.AuthError error = reporterGuard.get();
            return ResponseEntity.status(error.status()).body(error.body());
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(marketplaceService.createPledge(auth.userId(), payload));
    }

    @PostMapping("/v1/vendor-bids")
    public ResponseEntity<?> vendorBids(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) Map<String, Object> payload) {
        AuthContext auth = AuthSupport.extractAuthFromAuthorizationHeader(authorization, jwtService);
        if (auth == null) {
            return missingAuth();
        }
        if (!Roles.isCoordinatorApiRole(auth.role())) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("code", "forbidden");
            body.put("message", "Coordinator role required to submit vendor bids (MVP).");
            return ResponseEntity.status(403).body(body);
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(marketplaceService.createVendorBid(auth.userId(), payload));
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
