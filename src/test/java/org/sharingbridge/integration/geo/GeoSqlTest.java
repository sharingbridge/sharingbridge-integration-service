package org.sharingbridge.integration.geo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class GeoSqlTest {

    @Test
    void resolveGisSchemaRequiresValue() {
        assertThrows(IllegalStateException.class, () -> GeoSql.resolveGisSchema(""));
        assertThrows(IllegalStateException.class, () -> GeoSql.resolveGisSchema("   "));
        assertThrows(IllegalStateException.class, () -> GeoSql.resolveGisSchema(null));
    }

    @Test
    void resolveGisSchemaReadsValue() {
        assertEquals("gis_ext", GeoSql.resolveGisSchema("gis_ext"));
        assertEquals("extensions", GeoSql.resolveGisSchema("extensions"));
    }

    @Test
    void resolveGisSchemaRejectsInvalidIdentifiers() {
        assertThrows(IllegalStateException.class, () -> GeoSql.resolveGisSchema("bad-name"));
        assertThrows(IllegalStateException.class, () -> GeoSql.resolveGisSchema("9gis"));
    }

    @Test
    void gisFnQualifiesWithSchema() {
        assertEquals("extensions.ST_DWithin", GeoSql.gisFn("extensions", "ST_DWithin"));
    }

    @Test
    void gisPointFromParamsIncludesSchema() {
        String sql = GeoSql.gisPointFromParams("extensions", "$2", "$3");
        assertTrue(sql.contains("extensions.ST_MakePoint"));
        assertTrue(sql.contains("$2"));
        assertTrue(sql.contains("$3"));
    }
}
