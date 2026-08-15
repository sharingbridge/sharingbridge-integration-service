package org.sharingbridge.integration.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.geo.GeoSql;
import org.sharingbridge.integration.service.EcoKitchenPhase3;
import org.sharingbridge.integration.service.OrderCode;
import org.sharingbridge.integration.service.OrderIntentGeoSql;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

public class SeekerDemandRepository implements SeekerDemandStore {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final String gisSchema;
    private final boolean enabled;
    private final EcoKitchenPhase3.Flags phase3;

    public SeekerDemandRepository(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            String gisSchema,
            boolean enabled,
            EcoKitchenPhase3.Flags phase3) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.gisSchema = gisSchema;
        this.enabled = enabled;
        this.phase3 = phase3 == null ? EcoKitchenPhase3.Flags.none() : phase3;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    public static ApiException unavailableError() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "seeker_demand_schema_missing",
                "seeker_demands table is not present.");
    }

    @Override
    public Map<String, Object> insertForReporter(String reportedByUserId, Map<String, Object> record) {
        if (!enabled) {
            throw unavailableError();
        }
        Map<String, Object> withLocation = record;
        String payload = json(recordToPayload(withLocation));
        Map<String, Object> geo = OrderIntentGeoSql.geoColumnsFromRecord(withLocation);
        String lngParam = phase3.orderCodes() ? "$12" : "$9";
        String latParam = phase3.orderCodes() ? "$13" : "$10";
        String loc = GeoSql.locationSqlFragment(gisSchema, lngParam, latParam);
        if (phase3.orderCodes()) {
            execute(
                    "INSERT INTO seeker_demands (\n"
                            + "           seeker_demand_id, reported_by_user_id, status, meal_units, payload,\n"
                            + "           locality_key, location, created_at, updated_at,\n"
                            + "           order_code, initiation_route, initiator_email_share_consent_at\n"
                            + "         ) VALUES (\n"
                            + "           $1, $2, $3, $4, $5::jsonb, $6, "
                            + loc
                            + ", $7, $8,\n"
                            + "           $9, $10, $11::timestamptz\n"
                            + "         )",
                    List.of(
                            withLocation.get("id"),
                            reportedByUserId,
                            withLocation.get("status"),
                            withLocation.get("meal_units"),
                            payload,
                            emptyToNull(geo.get("localityKey")),
                            withLocation.get("created_at"),
                            withLocation.get("updated_at"),
                            withLocation.get("order_code"),
                            withLocation.get("initiation_route") != null
                                    ? withLocation.get("initiation_route")
                                    : "eco_kitchen_pledge",
                            withLocation.get("initiator_email_share_consent_at"),
                            geo.get("lng"),
                            geo.get("lat")));
        } else {
            execute(
                    "INSERT INTO seeker_demands (\n"
                            + "           seeker_demand_id, reported_by_user_id, status, meal_units, payload,\n"
                            + "           locality_key, location, created_at, updated_at\n"
                            + "         ) VALUES (\n"
                            + "           $1, $2, $3, $4, $5::jsonb, $6, "
                            + loc
                            + ", $7, $8\n"
                            + "         )",
                    List.of(
                            withLocation.get("id"),
                            reportedByUserId,
                            withLocation.get("status"),
                            withLocation.get("meal_units"),
                            payload,
                            emptyToNull(geo.get("localityKey")),
                            withLocation.get("created_at"),
                            withLocation.get("updated_at"),
                            geo.get("lng"),
                            geo.get("lat")));
        }
        return withLocation;
    }

    @Override
    public Map<String, Object> findByOrderCode(String orderCode) {
        if (!enabled || !phase3.orderCodes() || !OrderCode.isValidOrderCode(orderCode)) {
            return null;
        }
        String[] cols = selectColumnFragments();
        return one(
                "SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,\n"
                        + "              locality_key, created_at, updated_at"
                        + cols[0]
                        + cols[1]
                        + ",\n"
                        + "              NULL::double precision AS geo_lat, NULL::double precision AS geo_lng\n"
                        + "       FROM seeker_demands\n"
                        + "       WHERE order_code = $1\n"
                        + "       LIMIT 1",
                List.of(orderCode));
    }

    @Override
    public List<Map<String, Object>> listRecent(int limit, String reporterUserIdFilter) {
        if (!enabled) {
            return List.of();
        }
        int capped = Math.min(Math.max(limit <= 0 ? 100 : limit, 1), 200);
        List<Object> params = new ArrayList<>();
        params.add(capped);
        String where = "";
        if (reporterUserIdFilter != null && !reporterUserIdFilter.isBlank()) {
            params.add(reporterUserIdFilter);
            where = "WHERE reported_by_user_id = $2";
        }
        String[] cols = selectColumnFragments();
        String geoSql =
                "SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,\n"
                        + "              locality_key, created_at, updated_at"
                        + cols[0]
                        + cols[1]
                        + ",\n"
                        + "              "
                        + GeoSql.gisFn(gisSchema, "ST_Y")
                        + "(location::geometry) AS geo_lat,\n"
                        + "              "
                        + GeoSql.gisFn(gisSchema, "ST_X")
                        + "(location::geometry) AS geo_lng\n"
                        + "       FROM seeker_demands\n"
                        + "       "
                        + where
                        + "\n"
                        + "       ORDER BY updated_at DESC\n"
                        + "       LIMIT $1";
        String plainSql =
                "SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,\n"
                        + "              locality_key, created_at, updated_at"
                        + cols[0]
                        + cols[1]
                        + ",\n"
                        + "              NULL::double precision AS geo_lat,\n"
                        + "              NULL::double precision AS geo_lng\n"
                        + "       FROM seeker_demands\n"
                        + "       "
                        + where
                        + "\n"
                        + "       ORDER BY updated_at DESC\n"
                        + "       LIMIT $1";
        try {
            return query(geoSql, params);
        } catch (DataAccessException ex) {
            if (!SqlRecords.isUndefinedFunction(ex)) {
                throw ex;
            }
            return query(plainSql, params);
        }
    }

    @Override
    public Map<String, Object> findById(String seekerDemandId) {
        if (!enabled || seekerDemandId == null || seekerDemandId.trim().isEmpty()) {
            return null;
        }
        String[] cols = selectColumnFragments();
        return one(
                "SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,\n"
                        + "              locality_key, created_at, updated_at"
                        + cols[0]
                        + cols[1]
                        + ",\n"
                        + "              NULL::double precision AS geo_lat, NULL::double precision AS geo_lng\n"
                        + "       FROM seeker_demands\n"
                        + "       WHERE seeker_demand_id = $1\n"
                        + "       LIMIT 1",
                List.of(seekerDemandId.trim()));
    }

    @Override
    public Map<String, Object> updateByCoordinator(String seekerDemandId, Map<String, Object> record) {
        if (!enabled) {
            throw unavailableError();
        }
        String id = seekerDemandId == null ? "" : seekerDemandId.trim();
        if (id.isEmpty()) {
            return null;
        }
        int updated;
        if (phase3.deliveryTimestamp()) {
            updated =
                    update(
                            """
                            UPDATE seeker_demands
                             SET status = $2,
                                 updated_at = $3::timestamptz,
                                 delivered_at = $4::timestamptz
                             WHERE seeker_demand_id = $1
                            """,
                            List.of(id, record.get("status"), record.get("updated_at"), record.get("delivered_at")));
        } else {
            updated =
                    update(
                            """
                            UPDATE seeker_demands
                             SET status = $2,
                                 updated_at = $3::timestamptz
                             WHERE seeker_demand_id = $1
                            """,
                            List.of(id, record.get("status"), record.get("updated_at")));
        }
        return updated > 0 ? findById(id) : null;
    }

    private String[] selectColumnFragments() {
        String phaseCols =
                phase3.orderCodes()
                        ? ", order_code, initiation_route, initiator_email_share_consent_at"
                        : ", NULL::text AS order_code, 'eco_kitchen_pledge'::text AS initiation_route,\n"
                                + "         NULL::timestamptz AS initiator_email_share_consent_at";
        String deliveredCol =
                phase3.deliveryTimestamp()
                        ? ", delivered_at"
                        : ", NULL::timestamptz AS delivered_at";
        return new String[] {phaseCols, deliveredCol};
    }

    private Map<String, Object> recordToPayload(Map<String, Object> record) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("need_description", record.get("need_description"));
        payload.put("standard_offer_id", record.get("standard_offer_id"));
        payload.put(
                "menu_label",
                record.get("menu_label") != null
                        ? record.get("menu_label")
                        : (record.get("need_description") != null ? record.get("need_description") : ""));
        payload.put(
                "price_inr",
                record.get("price_inr") instanceof Number n ? n.doubleValue() : null);
        payload.put("verbal_notes", record.get("verbal_notes") != null ? record.get("verbal_notes") : "");
        payload.put(
                "location_lat",
                record.get("location_lat") instanceof Number n ? n.doubleValue() : null);
        payload.put(
                "location_lng",
                record.get("location_lng") instanceof Number n ? n.doubleValue() : null);
        payload.put("location_label", record.get("location_label") != null ? record.get("location_label") : "");
        payload.put("locality_key", record.get("locality_key") != null ? record.get("locality_key") : "");
        return payload;
    }

    private Map<String, Object> rowToRecord(Map<String, Object> row) {
        Map<String, Object> payload = SqlRecords.jsonMap(row.get("payload"), objectMapper);
        Double geoLat = SqlRecords.asFiniteDouble(row.get("geo_lat"));
        Double geoLng = SqlRecords.asFiniteDouble(row.get("geo_lng"));
        Double payloadLat = SqlRecords.asFiniteDouble(payload.get("location_lat"));
        Double payloadLng = SqlRecords.asFiniteDouble(payload.get("location_lng"));
        String columnKey =
                row.get("locality_key") instanceof String text ? text.trim() : "";
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", row.get("seeker_demand_id"));
        record.put("order_code", row.get("order_code"));
        record.put(
                "initiation_route",
                row.get("initiation_route") != null ? row.get("initiation_route") : "eco_kitchen_pledge");
        Object consent = row.get("initiator_email_share_consent_at");
        record.put("initiator_email_share_consent_at", consent == null ? null : SqlRecords.toIso(consent));
        record.put("reported_by_user_id", row.get("reported_by_user_id"));
        record.put("status", row.get("status"));
        Double units = SqlRecords.asFiniteDouble(row.get("meal_units"));
        record.put("meal_units", units == null ? 1 : (int) Math.round(units));
        record.put("need_description", String.valueOf(payload.getOrDefault("need_description", "")));
        String offerId = String.valueOf(payload.getOrDefault("standard_offer_id", "")).trim();
        record.put("standard_offer_id", offerId.isEmpty() ? null : offerId);
        Object menu = payload.get("menu_label");
        if (menu == null) {
            menu = payload.get("need_description");
        }
        record.put("menu_label", String.valueOf(menu == null ? "" : menu));
        record.put(
                "price_inr",
                payload.get("price_inr") instanceof Number n ? n.doubleValue() : null);
        record.put("verbal_notes", String.valueOf(payload.getOrDefault("verbal_notes", "")));
        record.put("location_lat", payloadLat != null ? payloadLat : geoLat);
        record.put("location_lng", payloadLng != null ? payloadLng : geoLng);
        record.put("location_label", String.valueOf(payload.getOrDefault("location_label", "")));
        record.put(
                "locality_key",
                !columnKey.isEmpty()
                        ? columnKey
                        : String.valueOf(payload.getOrDefault("locality_key", "")));
        String created = SqlRecords.toIso(row.get("created_at"));
        String updated = SqlRecords.toIso(row.get("updated_at"));
        record.put("created_at", created != null ? created : String.valueOf(row.get("created_at")));
        record.put("updated_at", updated != null ? updated : String.valueOf(row.get("updated_at")));
        Object delivered = row.get("delivered_at");
        record.put("delivered_at", delivered == null ? null : SqlRecords.toIso(delivered));
        return record;
    }

    private void execute(String sql, List<Object> values) {
        PgParams.Converted converted = PgParams.convert(sql, values);
        jdbc.update(converted.sql(), converted.args());
    }

    private int update(String sql, List<Object> values) {
        PgParams.Converted converted = PgParams.convert(sql, values);
        return jdbc.update(converted.sql(), converted.args());
    }

    private List<Map<String, Object>> query(String sql, List<Object> values) {
        PgParams.Converted converted = PgParams.convert(sql, values);
        return jdbc.query(converted.sql(), (rs, i) -> rowToRecord(SqlRecords.rowMap(rs)), converted.args());
    }

    private Map<String, Object> one(String sql, List<Object> values) {
        List<Map<String, Object>> rows = query(sql, values);
        return rows.isEmpty() ? null : rows.get(0);
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
        return String.valueOf(value).isEmpty() ? null : value;
    }
}
