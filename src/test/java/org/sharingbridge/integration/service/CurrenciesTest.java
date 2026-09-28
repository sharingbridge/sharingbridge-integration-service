package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class CurrenciesTest {

    @Test
    void fromDbUppercasesAndRejectsBlank() {
        assertEquals("USD", Currencies.fromDb("usd"));
        assertEquals("INR", Currencies.fromDb("INR"));
        assertNull(Currencies.fromDb(null));
        assertNull(Currencies.fromDb(""));
        assertNull(Currencies.fromDb("   "));
        assertNull(Currencies.fromDb("null"));
    }
}
