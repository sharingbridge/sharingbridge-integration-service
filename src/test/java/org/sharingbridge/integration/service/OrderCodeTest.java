package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class OrderCodeTest {

    @Test
    void generateOrderCodeMatchesSbPattern() {
        String code = OrderCode.generateOrderCode();
        assertTrue(OrderCode.isValidOrderCode(code));
        assertTrue(code.startsWith("SB-"));
    }

    @Test
    void isValidOrderCodeRejectsBadValues() {
        assertFalse(OrderCode.isValidOrderCode("SB-1-2"));
        assertFalse(OrderCode.isValidOrderCode(null));
        assertFalse(OrderCode.isValidOrderCode("not-a-code"));
        assertTrue(OrderCode.isValidOrderCode("SB-7K2M-9F3"));
    }
}
