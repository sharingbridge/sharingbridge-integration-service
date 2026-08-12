package org.sharingbridge.integration.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RolesTest {

    @Test
    void donorNormalizesToInitiator() {
        assertTrue(Roles.isInitiatorRole("donor"));
        assertEquals(Roles.ROLE_INITIATOR, Roles.normalizeRole("donor"));
        assertEquals(Roles.ROLE_INITIATOR, Roles.normalizeRole("initiator"));
        assertEquals(Roles.ROLE_COORDINATOR, Roles.normalizeRole("coordinator"));
    }
}
