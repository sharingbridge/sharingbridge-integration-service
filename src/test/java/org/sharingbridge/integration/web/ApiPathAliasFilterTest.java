package org.sharingbridge.integration.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class ApiPathAliasFilterTest {

    @Test
    void initiatorSetupRewritesToDonorSetup() {
        assertEquals(
                "/v1/donor-setup/preferences",
                ApiPathAliases.normalize("/v1/initiator-setup/preferences"));
        assertEquals(
                "/v1/donor-setup/preferences?x=1",
                ApiPathAliases.normalize("/v1/initiator-setup/preferences?x=1"));
    }

    @Test
    void instructionPackAndOrderIntentsRewrite() {
        assertEquals(
                "/v1/donor-seeker/instruction-pack",
                ApiPathAliases.normalize("/v1/instruction-pack"));
        assertEquals(
                "/v1/donor-seeker/order-intents",
                ApiPathAliases.normalize("/v1/order-intents"));
        assertEquals(
                "/v1/donor-seeker/order-intents/",
                ApiPathAliases.normalize("/v1/order-intents/"));
        assertEquals(
                "/v1/donor-seeker/order-intents/abc?q=1",
                ApiPathAliases.normalize("/v1/order-intents/abc?q=1"));
    }

    @Test
    void leavesCanonicalAndUnknownPathsUnchanged() {
        assertEquals(
                "/v1/donor-setup/preferences",
                ApiPathAliases.normalize("/v1/donor-setup/preferences"));
        assertEquals("/health", ApiPathAliases.normalize("/health"));
        assertNull(ApiPathAliases.normalize(null));
        assertEquals("", ApiPathAliases.normalize(""));
    }
}
