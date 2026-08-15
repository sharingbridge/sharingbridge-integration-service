package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.web.ApiException;

class MarketplaceServiceTest {

    @Test
    void createPledgeThrows503WhenStoreMissing() {
        MarketplaceService service = new MarketplaceService(null, null, null, null, null);
        ApiException ex =
                assertThrows(
                        ApiException.class,
                        () ->
                                service.createPledge(
                                        "alice",
                                        Map.of(
                                                "locality_key",
                                                "IN:TN:600115",
                                                "standard_offer_id",
                                                "so-lunch-full",
                                                "email_share_consent",
                                                true)));
        assertEquals("marketplace_unavailable", ex.getCode());
        assertEquals(503, ex.getStatus().value());
    }

    @Test
    void createVendorBidThrows503WhenStoreMissing() {
        MarketplaceService service = new MarketplaceService(null, null, null, null, null);
        ApiException ex =
                assertThrows(
                        ApiException.class,
                        () ->
                                service.createVendorBid(
                                        "coord-1",
                                        Map.of(
                                                "locality_key",
                                                "IN:TN:600115",
                                                "standard_offer_id",
                                                "so-lunch-full",
                                                "vendor_name",
                                                "A2B",
                                                "portions",
                                                10,
                                                "email_share_consent",
                                                true)));
        assertEquals("marketplace_unavailable", ex.getCode());
    }
}
