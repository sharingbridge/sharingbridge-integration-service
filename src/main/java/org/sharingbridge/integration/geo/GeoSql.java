package org.sharingbridge.integration.geo;

import java.util.regex.Pattern;

/** PostGIS schema qualification matching Node {@code geoSql.js}. */
public final class GeoSql {

    private static final Pattern SCHEMA_NAME = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]*$");

    private GeoSql() {}

    public static String resolveGisSchema() {
        return resolveGisSchema(System.getenv("GIS_SCHEMA"));
    }

    public static String resolveGisSchema(String rawEnv) {
        String raw = rawEnv == null ? "" : rawEnv.trim();
        if (raw.isEmpty()) {
            throw new IllegalStateException(
                    "GIS_SCHEMA is required — set the spatial extension schema to match database DDL (see configuration/environment-variables.md).");
        }
        if (raw.length() > 63 || !SCHEMA_NAME.matcher(raw).matches()) {
            throw new IllegalStateException(
                    "GIS_SCHEMA must be a valid SQL identifier (got \"" + raw + "\").");
        }
        return raw;
    }

    public static String gisFn(String schema, String name) {
        return schema + "." + name;
    }

    public static String geographyType(String schema) {
        return schema + ".geography";
    }

    public static String locationSqlFragment(String schema, String lngParam, String latParam) {
        String geo = geographyType(schema);
        return "CASE\n"
                + "    WHEN " + lngParam + "::double precision IS NOT NULL\n"
                + "     AND " + latParam + "::double precision IS NOT NULL\n"
                + "    THEN " + gisFn(schema, "ST_SetSRID") + "(" + gisFn(schema, "ST_MakePoint")
                + "(" + lngParam + "::double precision, " + latParam
                + "::double precision), 4326)::" + geo + "\n"
                + "    ELSE NULL\n"
                + "  END";
    }

    public static String gisPointFromParams(String schema, String lngParam, String latParam) {
        String geo = geographyType(schema);
        return gisFn(schema, "ST_SetSRID") + "(" + gisFn(schema, "ST_MakePoint")
                + "(" + lngParam + ", " + latParam + "), 4326)::" + geo;
    }
}
