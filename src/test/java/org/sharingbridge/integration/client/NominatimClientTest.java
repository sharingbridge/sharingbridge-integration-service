package org.sharingbridge.integration.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class NominatimClientTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void formatLocalityKeyFromNominatimBuildsPostalKey() throws Exception {
        ObjectNode root = mapper.createObjectNode();
        ObjectNode address = root.putObject("address");
        address.put("country_code", "in");
        address.put("state", "Tamil Nadu");
        address.put("postcode", "600115");

        String key = NominatimClient.formatLocalityKeyFromNominatim(root);
        assertEquals("IN:TN:600115", key);
    }

    @Test
    void formatLocalityKeyUsesIso3166RegionWhenPresent() throws Exception {
        ObjectNode root = mapper.createObjectNode();
        ObjectNode address = root.putObject("address");
        address.put("country_code", "in");
        address.put("ISO3166-2-lvl4", "IN-KA");
        address.put("postcode", "560001");

        assertEquals("IN:KA:560001", NominatimClient.formatLocalityKeyFromNominatim(root));
    }

    @Test
    void formatLocalityKeyReturnsCountryOnlyWhenNoRegion() throws Exception {
        ObjectNode root = mapper.createObjectNode();
        ObjectNode address = root.putObject("address");
        address.put("country_code", "in");

        assertEquals("IN", NominatimClient.formatLocalityKeyFromNominatim(root));
    }

    @Test
    void formatLocalityKeyReturnsNullForMissingAddress() {
        assertNull(NominatimClient.formatLocalityKeyFromNominatim(null));
        assertNull(NominatimClient.formatLocalityKeyFromNominatim(mapper.createObjectNode()));
    }

    @Test
    void formatDisplayAddressFromNominatimPrefersDisplayName() throws Exception {
        ObjectNode root = mapper.createObjectNode();
        root.put("display_name", "12 Temple Street, Chennai, Tamil Nadu, India");

        String text = NominatimClient.formatDisplayAddressFromNominatim(root);
        assertEquals("12 Temple Street, Chennai, Tamil Nadu, India", text);
    }

    @Test
    void formatDisplayAddressFromNominatimBuildsFromAddressParts() throws Exception {
        ObjectNode root = mapper.createObjectNode();
        ObjectNode address = root.putObject("address");
        address.put("road", "Temple Street");
        address.put("suburb", "Adyar");
        address.put("city", "Chennai");
        address.put("postcode", "600020");
        address.put("state", "Tamil Nadu");
        address.put("country", "India");

        String text = NominatimClient.formatDisplayAddressFromNominatim(root);
        assertTrue(text.contains("Temple Street"));
        assertTrue(text.contains("Chennai"));
    }
}
