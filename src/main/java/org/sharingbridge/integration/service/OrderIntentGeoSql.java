package org.sharingbridge.integration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.sharingbridge.integration.geo.OrderIntentListMaxRows;
import org.sharingbridge.integration.geo.NeighbourhoodFilter;
import org.sharingbridge.integration.geo.GeoSql;
import org.sharingbridge.integration.auth.Roles;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Dashboard list SQL matching Node {@code orderIntentGeoSql.js}.
 * Bind placeholders stay {@code $n} (Postgres reusable numbering).
 */
public final class OrderIntentGeoSql {

    private OrderIntentGeoSql() {}

    public record BuiltSql(String text, List<Object> values) {}

    public record ListOpts(
            String userIdFilter,
            Long sinceMs,
            NeighbourhoodFilter.Scope neighbourhoodScope,
            String viewerUserId,
            String role,
            Integer maxRows,
            Instant now) {

        public ListOpts {
            viewerUserId = viewerUserId == null ? "" : viewerUserId;
            role = role == null ? "" : role;
            now = now == null ? Instant.now() : now;
        }
    }

    public static BuiltSql buildOrderIntentListSql(ListOpts opts) {
        return buildOrderIntentListSql(GeoSql.resolveGisSchema(), opts);
    }

    public static BuiltSql buildOrderIntentListSql(String schema, ListOpts opts) {
        String userIdFilter = opts.userIdFilter();
        Long sinceMs = opts.sinceMs();
        NeighbourhoodFilter.Scope neighbourhoodScope = opts.neighbourhoodScope();
        String viewerUserId = opts.viewerUserId();
        String role = opts.role();
        int maxRows =
                opts.maxRows() == null
                        ? OrderIntentListMaxRows.getOrderIntentListMaxRows()
                        : opts.maxRows();

        List<Object> values = new ArrayList<>();
        List<String> where = new ArrayList<>();

        if (userIdFilter != null && !userIdFilter.trim().isEmpty()) {
            where.add("user_id = " + add(values, userIdFilter.trim()));
        }

        if (sinceMs != null && sinceMs > 0) {
            String cutoff = Instant.ofEpochMilli(opts.now().toEpochMilli() - sinceMs).toString();
            where.add("updated_at >= " + add(values, cutoff) + "::timestamptz");
        }

        String viewer = viewerUserId == null ? "" : viewerUserId.trim();
        boolean isCoordinator = Roles.isCoordinatorApiRole(role);
        String nearLngParam = null;
        String nearLatParam = null;

        if (neighbourhoodScope == null) {
            if (!isCoordinator && !viewer.isEmpty()) {
                where.add("user_id = " + add(values, viewer));
            }
        } else if (neighbourhoodScope instanceof NeighbourhoodFilter.NearScope near) {
            nearLngParam = add(values, near.nearLng());
            nearLatParam = add(values, near.nearLat());
            String radiusParam = add(values, near.radiusM());
            String viewerPoint = GeoSql.gisPointFromParams(schema, nearLngParam, nearLatParam);
            String withinRadius =
                    "(\n"
                            + "      location IS NOT NULL\n"
                            + "      AND "
                            + GeoSql.gisFn(schema, "ST_DWithin")
                            + "(location, "
                            + viewerPoint
                            + ", "
                            + radiusParam
                            + ")\n"
                            + "    )";
            if (!isCoordinator && !viewer.isEmpty()) {
                where.add("(user_id = " + add(values, viewer) + " OR " + withinRadius + ")");
            } else {
                where.add(withinRadius);
            }
        } else if (neighbourhoodScope instanceof NeighbourhoodFilter.LocalityScope locality) {
            String keyParam = add(values, locality.localityKey());
            String prefixParam = add(values, locality.localityKey() + ":%");
            String effectiveKey = effectiveLocalityKeySql();
            String localityMatch =
                    "(\n"
                            + "      "
                            + effectiveKey
                            + " IS NOT NULL\n"
                            + "      AND (\n"
                            + "        "
                            + effectiveKey
                            + " = "
                            + keyParam
                            + "\n"
                            + "        OR "
                            + effectiveKey
                            + " LIKE "
                            + prefixParam
                            + "\n"
                            + "      )\n"
                            + "    )";
            if (!isCoordinator && !viewer.isEmpty()) {
                where.add("(user_id = " + add(values, viewer) + " OR " + localityMatch + ")");
            } else {
                where.add(localityMatch);
            }
        }

        String whereSql = where.isEmpty() ? "" : "WHERE " + String.join(" AND ", where);
        String listColumns = baseColumns(schema) + ", NULL::integer AS distance_m";
        String orderBy = "updated_at DESC";

        if (neighbourhoodScope instanceof NeighbourhoodFilter.NearScope
                && nearLngParam != null
                && nearLatParam != null) {
            listColumns =
                    baseColumns(schema)
                            + ", "
                            + distanceMetresSelect(schema, nearLngParam, nearLatParam);
            orderBy = "distance_m ASC NULLS LAST, updated_at DESC";
        }

        String limitParam = add(values, maxRows);
        String text =
                "SELECT "
                        + listColumns
                        + "\n           FROM order_intents\n           "
                        + whereSql
                        + "\n           ORDER BY "
                        + orderBy
                        + "\n           LIMIT "
                        + limitParam;
        return new BuiltSql(text, values);
    }

    public static Map<String, Object> geoColumnsFromRecord(Map<String, Object> record) {
        String localityKey =
                record != null && record.get("locality_key") instanceof String text
                        ? text.trim()
                        : "";
        Object lat = record == null ? null : record.get("location_lat");
        Object lng = record == null ? null : record.get("location_lng");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("localityKey", localityKey);
        if (lat instanceof Number latN
                && lng instanceof Number lngN
                && Double.isFinite(latN.doubleValue())
                && Double.isFinite(lngN.doubleValue())) {
            out.put("lng", lngN.doubleValue());
            out.put("lat", latN.doubleValue());
        } else {
            out.put("lng", null);
            out.put("lat", null);
        }
        return out;
    }

    private static String add(List<Object> values, Object value) {
        values.add(value);
        return "$" + values.size();
    }

    private static String baseColumns(String schema) {
        return "order_intent_id, user_id, pack_id, status, payload, created_at, updated_at,\n"
                + "  locality_key,\n"
                + "  delivered_at,\n"
                + "  "
                + GeoSql.gisFn(schema, "ST_Y")
                + "(location::geometry) AS geo_lat,\n"
                + "  "
                + GeoSql.gisFn(schema, "ST_X")
                + "(location::geometry) AS geo_lng";
    }

    private static String effectiveLocalityKeySql() {
        return "COALESCE(\n"
                + "    NULLIF(TRIM(locality_key), ''),\n"
                + "    NULLIF(TRIM(payload->>'locality_key'), '')\n"
                + "  )";
    }

    private static String distanceMetresSelect(String schema, String lngParam, String latParam) {
        String viewerPoint =
                GeoSql.gisPointFromParams(
                        schema, lngParam + "::double precision", latParam + "::double precision");
        return "CASE\n"
                + "    WHEN location IS NOT NULL THEN ROUND(\n"
                + "      "
                + GeoSql.gisFn(schema, "ST_Distance")
                + "(\n"
                + "        location,\n"
                + "        "
                + viewerPoint
                + "\n"
                + "      )::numeric\n"
                + "    )::integer\n"
                + "    ELSE NULL\n"
                + "  END AS distance_m";
    }
}
