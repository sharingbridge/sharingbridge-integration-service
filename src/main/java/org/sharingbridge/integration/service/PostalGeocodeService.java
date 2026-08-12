package org.sharingbridge.integration.service;

import java.util.LinkedHashMap;
import java.util.Map;
import org.sharingbridge.integration.client.NominatimClient;
import org.sharingbridge.integration.client.NominatimClient.ReverseResult;
import org.springframework.stereotype.Service;

/**
 * Reverse geocode GPS to postal locality_key + display address. Matches Node {@code postalGeocode.js}
 * / {@code geocodeApi.js}.
 */
@Service
public class PostalGeocodeService {

    private final NominatimClient nominatimClient;

    public PostalGeocodeService(NominatimClient nominatimClient) {
        this.nominatimClient = nominatimClient;
    }

    public String derivePostalLocalityKey(double lat, double lng) {
        ReverseResult result = nominatimClient.fetchReverse(lat, lng);
        return result == null ? null : result.localityKey();
    }

    /**
     * @return map with location_lat, location_lng, locality_key, formatted_address; or null on failure
     */
    public Map<String, Object> reverseGeocodeLocation(double lat, double lng) {
        ReverseResult result = nominatimClient.fetchReverse(lat, lng);
        if (result == null) {
            return null;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("location_lat", lat);
        body.put("location_lng", lng);
        body.put("locality_key", result.localityKey() == null ? "" : result.localityKey());
        body.put(
                "formatted_address",
                result.formattedAddress() == null ? "" : result.formattedAddress());
        return body;
    }

    /** Matches Node {@code formatReverseGeocodeForApi}. */
    public static Map<String, Object> formatReverseGeocodeForApi(Map<String, Object> result) {
        if (result == null) {
            return null;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("location_lat", result.get("location_lat"));
        body.put("location_lng", result.get("location_lng"));
        Object locality = result.get("locality_key");
        body.put("locality_key", locality == null ? "" : locality);
        Object address = result.get("formatted_address");
        body.put("formatted_address", address == null ? "" : address);
        return body;
    }
}
