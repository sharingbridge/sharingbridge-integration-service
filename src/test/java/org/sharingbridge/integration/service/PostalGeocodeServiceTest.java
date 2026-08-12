package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.sharingbridge.integration.client.NominatimClient;
import org.sharingbridge.integration.client.NominatimClient.ReverseResult;

@ExtendWith(MockitoExtension.class)
class PostalGeocodeServiceTest {

    @Mock
    private NominatimClient nominatimClient;

    @Test
    void reverseGeocodeLocationMapsResult() {
        when(nominatimClient.fetchReverse(12.94, 80.24))
                .thenReturn(new ReverseResult("IN:TN:600115", "Adyar, Chennai"));

        PostalGeocodeService service = new PostalGeocodeService(nominatimClient);
        Map<String, Object> result = service.reverseGeocodeLocation(12.94, 80.24);

        assertEquals(12.94, result.get("location_lat"));
        assertEquals(80.24, result.get("location_lng"));
        assertEquals("IN:TN:600115", result.get("locality_key"));
        assertEquals("Adyar, Chennai", result.get("formatted_address"));
    }

    @Test
    void reverseGeocodeLocationReturnsNullOnUpstreamFailure() {
        when(nominatimClient.fetchReverse(1.0, 2.0)).thenReturn(null);
        PostalGeocodeService service = new PostalGeocodeService(nominatimClient);
        assertNull(service.reverseGeocodeLocation(1.0, 2.0));
    }

    @Test
    void derivePostalLocalityKeyReturnsKeyOrNull() {
        when(nominatimClient.fetchReverse(12.94, 80.24))
                .thenReturn(new ReverseResult("IN:TN:600115", "Adyar"));
        when(nominatimClient.fetchReverse(0.0, 0.0)).thenReturn(null);

        PostalGeocodeService service = new PostalGeocodeService(nominatimClient);
        assertEquals("IN:TN:600115", service.derivePostalLocalityKey(12.94, 80.24));
        assertNull(service.derivePostalLocalityKey(0.0, 0.0));
        verify(nominatimClient).fetchReverse(12.94, 80.24);
    }

    @Test
    void formatReverseGeocodeForApiNullSafe() {
        assertNull(PostalGeocodeService.formatReverseGeocodeForApi(null));
        Map<String, Object> formatted =
                PostalGeocodeService.formatReverseGeocodeForApi(
                        Map.of("location_lat", 1.0, "location_lng", 2.0));
        assertEquals("", formatted.get("locality_key"));
        assertEquals("", formatted.get("formatted_address"));
    }
}
