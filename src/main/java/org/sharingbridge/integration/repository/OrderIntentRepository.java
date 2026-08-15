package org.sharingbridge.integration.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.geo.GeoSql;
import org.sharingbridge.integration.service.EcoKitchenPhase3;
import org.sharingbridge.integration.service.OrderIntentGeoSql;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

public class OrderIntentRepository implements OrderIntentStore {

    private static final String SCHEMA_HINT =
            "Run sharingbridge/configuration/schema.sql (new DB) and schema-delivered-at-migration.sql (delivered_at), then restart integration-service.";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final String gisSchema;
    private final EcoKitchenPhase3.Flags phase3;

    public OrderIntentRepository(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            String gisSchema,
            EcoKitchenPhase3.Flags phase3) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.gisSchema = gisSchema;
        this.phase3 = phase3 == null ? EcoKitchenPhase3.Flags.none() : phase3;
        assertOrderIntentGeoSchema(jdbc, gisSchema);
    }

    public static void assertOrderIntentGeoSchema(JdbcTemplate jdbc, String schema) {
        Integer location =
                jdbc.query(
                        """
                        SELECT 1
                         FROM information_schema.columns
                         WHERE table_schema = 'public'
                           AND table_name = 'order_intents'
                           AND column_name = 'location'
                         LIMIT 1
                        """,
                        rs -> rs.next() ? 1 : 0);
        if (location == null || location == 0) {
            throw new IllegalStateException("order_intents.location column is required. " + SCHEMA_HINT);
        }
        Integer delivered =
                jdbc.query(
                        """
                        SELECT 1
                         FROM information_schema.columns
                         WHERE table_schema = 'public'
                           AND table_name = 'order_intents'
                           AND column_name = 'delivered_at'
                         LIMIT 1
                        """,
                        rs -> rs.next() ? 1 : 0);
        if (delivered == null || delivered == 0) {
            throw new IllegalStateException(
                    "order_intents.delivered_at column is required. " + SCHEMA_HINT);
        }
        String point = GeoSql.gisPointFromParams(schema, "0", "0");
        try {
            jdbc.execute(
                    "SELECT "
                            + GeoSql.gisFn(schema, "ST_DWithin")
                            + "(\n         "
                            + point
                            + ",\n         "
                            + point
                            + ",\n         1\n       )");
        } catch (DataAccessException ex) {
            throw new IllegalStateException(
                    "Spatial geo queries are unavailable ("
                            + ex.getMostSpecificCause().getMessage()
                            + "). "
                            + SCHEMA_HINT,
                    ex);
        }
    }

    @Override
    public Map<String, Object> findByPackId(String userId, String packId) {
        String normalized = packId == null ? "" : packId.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return one(
                """
                SELECT order_intent_id, user_id, pack_id, status, payload, created_at, updated_at
                 FROM order_intents
                 WHERE user_id = $1 AND pack_id = $2
                """,
                List.of(userId, normalized));
    }

    @Override
    public Map<String, Object> findById(String userId, String orderIntentId) {
        String normalized = orderIntentId == null ? "" : orderIntentId.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return one(
                """
                SELECT order_intent_id, user_id, pack_id, status, payload, created_at, updated_at, delivered_at
                 FROM order_intents
                 WHERE user_id = $1 AND order_intent_id = $2
                """,
                List.of(userId, normalized));
    }

    @Override
    public Map<String, Object> findByIdAny(String orderIntentId) {
        String normalized = orderIntentId == null ? "" : orderIntentId.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return one(
                """
                SELECT order_intent_id, user_id, pack_id, status, payload, created_at, updated_at, delivered_at
                 FROM order_intents
                 WHERE order_intent_id = $1
                """,
                List.of(normalized));
    }

    @Override
    public Map<String, Object> updateRecordForUser(String userId, Map<String, Object> record) {
        Map<String, Object> existing = findById(userId, String.valueOf(record.get("id")));
        if (existing == null) {
            return null;
        }
        String payload = json(recordToPayload(record));
        String updatedAt =
                record.get("updated_at") != null
                        ? String.valueOf(record.get("updated_at"))
                        : java.time.Instant.now().toString();
        String deliveredAt = null;
        if (record.get("delivered_at") instanceof String text && !text.trim().isEmpty()) {
            deliveredAt = text.trim();
        }
        Map<String, Object> geo = OrderIntentGeoSql.geoColumnsFromRecord(record);
        String loc = GeoSql.locationSqlFragment(gisSchema, "$8", "$9");
        return one(
                "UPDATE order_intents SET\n"
                        + "         status = $3,\n"
                        + "         payload = $4::jsonb,\n"
                        + "         updated_at = $5::timestamptz,\n"
                        + "         locality_key = $6,\n"
                        + "         delivered_at = $7::timestamptz,\n"
                        + "         location = "
                        + loc
                        + "\n       WHERE user_id = $1 AND order_intent_id = $2\n"
                        + "       RETURNING order_intent_id, user_id, pack_id, status, payload, created_at, updated_at, delivered_at",
                List.of(
                        userId,
                        record.get("id"),
                        record.get("status"),
                        payload,
                        updatedAt,
                        emptyToNull(geo.get("localityKey")),
                        deliveredAt,
                        geo.get("lng"),
                        geo.get("lat")));
    }

    @Override
    public UpsertResult upsertForUser(String userId, Map<String, Object> record) {
        String packId =
                record.get("pack_id") instanceof String text ? text.trim() : "";
        Map<String, Object> existing = packId.isEmpty() ? null : findByPackId(userId, packId);
        String payload = json(recordToPayload(record));
        String createdAt =
                existing != null && existing.get("created_at") != null
                        ? String.valueOf(existing.get("created_at"))
                        : record.get("created_at") != null
                                ? String.valueOf(record.get("created_at"))
                                : java.time.Instant.now().toString();
        String updatedAt =
                record.get("updated_at") != null
                        ? String.valueOf(record.get("updated_at"))
                        : java.time.Instant.now().toString();
        Map<String, Object> geo = OrderIntentGeoSql.geoColumnsFromRecord(record);

        if (existing != null) {
            String loc = GeoSql.locationSqlFragment(gisSchema, "$7", "$8");
            String returning =
                    phase3.orderCodes()
                            ? "order_intent_id, user_id, pack_id, status, payload, created_at, updated_at,\n"
                                    + "           order_code, initiation_route, delivered_at"
                            : "order_intent_id, user_id, pack_id, status, payload, created_at, updated_at";
            Map<String, Object> saved =
                    one(
                            "UPDATE order_intents SET\n"
                                    + "           status = $3,\n"
                                    + "           payload = $4::jsonb,\n"
                                    + "           updated_at = $5::timestamptz,\n"
                                    + "           locality_key = $6,\n"
                                    + "           location = "
                                    + loc
                                    + "\n         WHERE user_id = $1 AND pack_id = $2\n"
                                    + "         RETURNING "
                                    + returning,
                            List.of(
                                    userId,
                                    existing.get("pack_id"),
                                    record.get("status"),
                                    payload,
                                    updatedAt,
                                    emptyToNull(geo.get("localityKey")),
                                    geo.get("lng"),
                                    geo.get("lat")));
            return new UpsertResult(saved, false);
        }

        String lngParam = phase3.orderCodes() ? "$11" : "$9";
        String latParam = phase3.orderCodes() ? "$12" : "$10";
        String loc = GeoSql.locationSqlFragment(gisSchema, lngParam, latParam);
        if (phase3.orderCodes()) {
            Map<String, Object> saved =
                    one(
                            "INSERT INTO order_intents (\n"
                                    + "           order_intent_id, user_id, pack_id, status, payload, created_at, updated_at,\n"
                                    + "           locality_key, location, order_code, initiation_route\n"
                                    + "         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz, $8,\n"
                                    + "           "
                                    + loc
                                    + ", $9, $10)\n"
                                    + "         RETURNING order_intent_id, user_id, pack_id, status, payload, created_at, updated_at,\n"
                                    + "           order_code, initiation_route, delivered_at",
                            List.of(
                                    record.get("id"),
                                    userId,
                                    packId,
                                    record.get("status"),
                                    payload,
                                    createdAt,
                                    updatedAt,
                                    emptyToNull(geo.get("localityKey")),
                                    record.get("order_code"),
                                    record.get("initiation_route") != null
                                            ? record.get("initiation_route")
                                            : "direct_order",
                                    geo.get("lng"),
                                    geo.get("lat")));
            return new UpsertResult(saved, true);
        }
        Map<String, Object> saved =
                one(
                        "INSERT INTO order_intents (\n"
                                + "         order_intent_id, user_id, pack_id, status, payload, created_at, updated_at,\n"
                                + "         locality_key, location\n"
                                + "       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz, $8,\n"
                                + "         "
                                + loc
                                + ")\n"
                                + "       RETURNING order_intent_id, user_id, pack_id, status, payload, created_at, updated_at",
                        List.of(
                                record.get("id"),
                                userId,
                                packId,
                                record.get("status"),
                                payload,
                                createdAt,
                                updatedAt,
                                emptyToNull(geo.get("localityKey")),
                                geo.get("lng"),
                                geo.get("lat")));
        return new UpsertResult(saved, true);
    }

    @Override
    public List<Map<String, Object>> listForDashboard(OrderIntentGeoSql.ListOpts opts) {
        OrderIntentGeoSql.BuiltSql built = OrderIntentGeoSql.buildOrderIntentListSql(gisSchema, opts);
        PgParams.Converted converted = PgParams.convert(built.text(), built.values());
        try {
            return jdbc.query(
                    converted.sql(),
                    (rs, i) -> rowToRecord(SqlRecords.rowMap(rs)),
                    converted.args());
        } catch (DataAccessException ex) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "internal_error",
                    ex.getMostSpecificCause().getMessage());
        }
    }

    private Map<String, Object> one(String sql, List<Object> values) {
        PgParams.Converted converted = PgParams.convert(sql, values);
        List<Map<String, Object>> rows =
                jdbc.query(converted.sql(), (rs, i) -> rowToRecord(SqlRecords.rowMap(rs)), converted.args());
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Object> recordToPayload(Map<String, Object> record) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("has_reference_photo", Boolean.TRUE.equals(record.get("has_reference_photo")));
        payload.put(
                "reference_photo_artifact_id",
                record.get("reference_photo_artifact_id") != null
                        ? record.get("reference_photo_artifact_id")
                        : "");
        payload.put(
                "reference_photo_view_url",
                record.get("reference_photo_view_url") != null
                        ? record.get("reference_photo_view_url")
                        : "");
        payload.put(
                "reference_photo_thumbnail_url",
                record.get("reference_photo_thumbnail_url") != null
                        ? record.get("reference_photo_thumbnail_url")
                        : "");
        payload.put(
                "verbal_handover_notes",
                record.get("verbal_handover_notes") != null ? record.get("verbal_handover_notes") : "");
        payload.put(
                "presets_snapshot",
                record.get("presets_snapshot") instanceof List<?> list ? list : List.of());
        payload.put(
                "selected_preset",
                record.get("selected_preset") instanceof Map<?, ?> map ? record.get("selected_preset") : null);
        payload.put(
                "location_lat",
                record.get("location_lat") instanceof Number n ? n.doubleValue() : null);
        payload.put(
                "location_lng",
                record.get("location_lng") instanceof Number n ? n.doubleValue() : null);
        payload.put(
                "location_label",
                record.get("location_label") instanceof String text ? text : "");
        payload.put(
                "locality_key",
                record.get("locality_key") instanceof String text ? text : "");
        payload.put(
                "location_description",
                record.get("location_description") != null ? record.get("location_description") : "");
        payload.put(
                "image_description",
                record.get("image_description") != null ? record.get("image_description") : "");
        payload.put(
                "seeker_appearance_hints",
                record.get("seeker_appearance_hints") != null
                        ? record.get("seeker_appearance_hints")
                        : "");
        payload.put(
                "seeker_handover_hints",
                record.get("seeker_handover_hints") != null ? record.get("seeker_handover_hints") : "");
        payload.put(
                "payment_status",
                record.get("payment_status") instanceof String text ? text : "pending");
        payload.put(
                "delivery_status",
                record.get("delivery_status") instanceof String text ? text : "pending");
        payload.put(
                "delivery_photo_url",
                record.get("delivery_photo_url") instanceof String text ? text : "");
        return payload;
    }

    private Map<String, Object> rowToRecord(Map<String, Object> row) {
        Map<String, Object> payload = SqlRecords.jsonMap(row.get("payload"), objectMapper);
        Double payloadLat = SqlRecords.asFiniteDouble(payload.get("location_lat"));
        Double payloadLng = SqlRecords.asFiniteDouble(payload.get("location_lng"));
        Double geoLat = SqlRecords.asFiniteDouble(row.get("geo_lat"));
        Double geoLng = SqlRecords.asFiniteDouble(row.get("geo_lng"));
        String columnKey =
                row.get("locality_key") instanceof String text ? text.trim() : "";
        String payloadKey =
                payload.get("locality_key") instanceof String text ? text.trim() : "";

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", row.get("order_intent_id"));
        record.put("order_code", row.get("order_code"));
        record.put(
                "initiation_route",
                row.get("initiation_route") != null ? row.get("initiation_route") : "direct_order");
        record.put("user_id", row.get("user_id"));
        record.put("pack_id", row.get("pack_id"));
        record.put("status", row.get("status"));
        record.put("has_reference_photo", Boolean.TRUE.equals(payload.get("has_reference_photo")));
        record.put(
                "reference_photo_artifact_id",
                payload.get("reference_photo_artifact_id") != null
                        ? payload.get("reference_photo_artifact_id")
                        : "");
        record.put(
                "reference_photo_view_url",
                payload.get("reference_photo_view_url") != null
                        ? payload.get("reference_photo_view_url")
                        : "");
        record.put(
                "reference_photo_thumbnail_url",
                payload.get("reference_photo_thumbnail_url") != null
                        ? payload.get("reference_photo_thumbnail_url")
                        : "");
        record.put(
                "verbal_handover_notes",
                payload.get("verbal_handover_notes") != null ? payload.get("verbal_handover_notes") : "");
        record.put(
                "presets_snapshot",
                payload.get("presets_snapshot") instanceof List<?> list ? list : List.of());
        record.put(
                "selected_preset",
                payload.get("selected_preset") instanceof Map<?, ?> ? payload.get("selected_preset") : null);
        record.put("location_lat", payloadLat != null ? payloadLat : geoLat);
        record.put("location_lng", payloadLng != null ? payloadLng : geoLng);
        record.put(
                "location_label",
                payload.get("location_label") instanceof String text ? text : "");
        record.put("locality_key", !columnKey.isEmpty() ? columnKey : payloadKey);
        record.put(
                "location_description",
                payload.get("location_description") instanceof String text ? text : "");
        record.put(
                "image_description",
                payload.get("image_description") instanceof String text ? text : "");
        record.put(
                "seeker_appearance_hints",
                payload.get("seeker_appearance_hints") instanceof String text ? text : "");
        record.put(
                "seeker_handover_hints",
                payload.get("seeker_handover_hints") instanceof String text ? text : "");
        record.put(
                "payment_status",
                payload.get("payment_status") instanceof String text ? text : "pending");
        record.put(
                "delivery_status",
                payload.get("delivery_status") instanceof String text ? text : "pending");
        record.put(
                "delivery_photo_url",
                payload.get("delivery_photo_url") instanceof String text ? text : "");
        String created = SqlRecords.toIso(row.get("created_at"));
        String updated = SqlRecords.toIso(row.get("updated_at"));
        record.put("created_at", created != null ? created : String.valueOf(row.get("created_at")));
        record.put("updated_at", updated != null ? updated : String.valueOf(row.get("updated_at")));
        record.put("delivered_at", formatDeliveredAt(row.get("delivered_at")));
        Integer distance = SqlRecords.asRoundedInt(row.get("distance_m"));
        record.put("distance_m", distance);
        return record;
    }

    private static String formatDeliveredAt(Object value) {
        if (value == null) {
            return null;
        }
        String iso = SqlRecords.toIso(value);
        if (iso == null || iso.isBlank()) {
            return null;
        }
        return iso;
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error", ex.getMessage());
        }
    }

    private static Object emptyToNull(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value);
        return text.isEmpty() ? null : value;
    }
}
