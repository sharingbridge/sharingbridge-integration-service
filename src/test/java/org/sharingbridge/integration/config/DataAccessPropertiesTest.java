package org.sharingbridge.integration.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DataAccessPropertiesTest {

    @Test
    void rewritesSupabasePoolerPortToSessionByDefault() {
        DataAccessProperties props = DataAccessProperties.fromEnvironment();
        DataAccessProperties.JdbcParts parts = props.toJdbcParts(
                "postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres");
        assertTrue(parts.url().contains(":5432/"));
        assertEquals("user", parts.username());
        assertEquals("pass", parts.password());
    }

    @Test
    void supabasePoolPortRejectsInvalidValue() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class, () -> SupabasePoolPort.fromEnv("9999"));
        assertTrue(ex.getMessage().contains("5432"));
    }

    @Test
    void supabasePoolPortAcceptsSessionAndTransaction() {
        assertEquals(SupabasePoolPort.SESSION, SupabasePoolPort.fromEnv("5432"));
        assertEquals(SupabasePoolPort.TRANSACTION, SupabasePoolPort.fromEnv("6543"));
    }
}
