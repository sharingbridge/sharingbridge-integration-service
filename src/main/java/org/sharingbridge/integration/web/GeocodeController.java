package org.sharingbridge.integration.web;

import java.util.LinkedHashMap;
import java.util.Map;
import org.sharingbridge.integration.auth.AuthContext;
import org.sharingbridge.integration.auth.AuthSupport;
import org.sharingbridge.integration.auth.JwtService;
import org.sharingbridge.integration.service.PostalGeocodeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GeocodeController {

    private final PostalGeocodeService postalGeocodeService;
    private final JwtService jwtService;

    public GeocodeController(PostalGeocodeService postalGeocodeService, JwtService jwtService) {
        this.postalGeocodeService = postalGeocodeService;
        this.jwtService = jwtService;
    }

    @GetMapping("/v1/geocode/reverse")
    public ResponseEntity<?> reverse(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(value = "location_lat", required = false) String locationLat,
            @RequestParam(value = "location_lng", required = false) String locationLng) {
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

        double lat = parseJsNumber(locationLat);
        double lng = parseJsNumber(locationLng);
        if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
            return ResponseEntity.status(400)
                    .body(Map.of(
                            "code",
                            "invalid_coordinates",
                            "message",
                            "location_lat and location_lng must be valid numbers."));
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return ResponseEntity.status(400)
                    .body(Map.of(
                            "code",
                            "invalid_coordinates",
                            "message",
                            "location_lat must be -90..90 and location_lng must be -180..180."));
        }

        try {
            Map<String, Object> result = postalGeocodeService.reverseGeocodeLocation(lat, lng);
            if (result == null) {
                return ResponseEntity.status(502)
                        .body(Map.of(
                                "code",
                                "reverse_geocode_unavailable",
                                "message",
                                "Could not resolve an address for these coordinates right now."));
            }
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("user_id", auth.userId());
            body.putAll(PostalGeocodeService.formatReverseGeocodeForApi(result));
            return ResponseEntity.ok(body);
        } catch (ApiException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            return ResponseEntity.status(500)
                    .body(Map.of(
                            "code",
                            "reverse_geocode_error",
                            "message",
                            ex.getMessage() == null
                                    ? "Could not reverse geocode location."
                                    : ex.getMessage()));
        }
    }

    /**
     * Approximate JS {@code Number(value)} for query params: {@code null} → 0, blank → 0, else parse.
     */
    static double parseJsNumber(String raw) {
        if (raw == null) {
            return 0.0;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return 0.0;
        }
        try {
            return Double.parseDouble(trimmed);
        } catch (NumberFormatException ex) {
            return Double.NaN;
        }
    }
}
