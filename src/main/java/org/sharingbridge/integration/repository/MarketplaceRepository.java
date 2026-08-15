package org.sharingbridge.integration.repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.service.EcoKitchenPhase3;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

public class MarketplaceRepository implements MarketplaceStore {

    private final JdbcTemplate jdbc;
    private final boolean enabled;
    private final EcoKitchenPhase3.Flags phase3;

    public MarketplaceRepository(
            JdbcTemplate jdbc, boolean enabled, EcoKitchenPhase3.Flags phase3) {
        this.jdbc = jdbc;
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
                "marketplace_schema_missing",
                "Marketplace tables (meal_pledges, vendor_bids, or standard_offers) are not present.");
    }

    @Override
    public Map<String, Object> insertPledge(Map<String, Object> record) {
        if (!enabled) {
            throw unavailableError();
        }
        String demandWindowId = trimToNull(record.get("demand_window_id"));
        if (phase3.pledgeConsent()) {
            execute(
                    """
                    INSERT INTO meal_pledges (
                       pledge_id, pledged_by_user_id, demand_window_id, locality_key,
                       standard_offer_id, meal_units, status, email_share_consent_at, created_at, updated_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10)
                    """,
                    List.of(
                            record.get("id"),
                            record.get("pledged_by_user_id"),
                            demandWindowId,
                            record.get("locality_key"),
                            record.get("standard_offer_id"),
                            record.get("meal_units"),
                            record.get("status"),
                            record.get("email_share_consent_at"),
                            record.get("created_at"),
                            record.get("updated_at")));
        } else {
            execute(
                    """
                    INSERT INTO meal_pledges (
                       pledge_id, pledged_by_user_id, demand_window_id, locality_key,
                       standard_offer_id, meal_units, status, created_at, updated_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """,
                    List.of(
                            record.get("id"),
                            record.get("pledged_by_user_id"),
                            demandWindowId,
                            record.get("locality_key"),
                            record.get("standard_offer_id"),
                            record.get("meal_units"),
                            record.get("status"),
                            record.get("created_at"),
                            record.get("updated_at")));
        }
        return record;
    }

    @Override
    public Map<String, Object> insertVendorBid(Map<String, Object> record) {
        if (!enabled) {
            throw unavailableError();
        }
        String demandWindowId = trimToNull(record.get("demand_window_id"));
        if (phase3.kitchenCommitment()) {
            execute(
                    """
                    INSERT INTO vendor_bids (
                       vendor_bid_id, submitted_by_user_id, demand_window_id, locality_key,
                       standard_offer_id, vendor_name, portions, notes, status,
                       email_share_consent_at, seeker_demand_id, order_code, commitment_status,
                       created_at, updated_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11, $12, $13, $14, $15)
                    """,
                    List.of(
                            record.get("id"),
                            record.get("submitted_by_user_id"),
                            demandWindowId,
                            record.get("locality_key"),
                            record.get("standard_offer_id"),
                            record.get("vendor_name"),
                            record.get("portions"),
                            record.get("notes") != null ? record.get("notes") : "",
                            record.get("status"),
                            record.get("email_share_consent_at"),
                            record.get("seeker_demand_id"),
                            record.get("order_code"),
                            record.get("commitment_status") != null
                                    ? record.get("commitment_status")
                                    : "committed",
                            record.get("created_at"),
                            record.get("updated_at")));
        } else {
            execute(
                    """
                    INSERT INTO vendor_bids (
                       vendor_bid_id, submitted_by_user_id, demand_window_id, locality_key,
                       standard_offer_id, vendor_name, portions, notes, status, created_at, updated_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    """,
                    List.of(
                            record.get("id"),
                            record.get("submitted_by_user_id"),
                            demandWindowId,
                            record.get("locality_key"),
                            record.get("standard_offer_id"),
                            record.get("vendor_name"),
                            record.get("portions"),
                            record.get("notes") != null ? record.get("notes") : "",
                            record.get("status"),
                            record.get("created_at"),
                            record.get("updated_at")));
        }
        return record;
    }

    @Override
    public Map<String, Object> findKitchenCommitmentByOrderCode(String orderCode) {
        if (!enabled || !phase3.kitchenCommitment() || orderCode == null || orderCode.isBlank()) {
            return null;
        }
        List<Map<String, Object>> rows =
                query(
                        """
                        SELECT b.vendor_bid_id, b.submitted_by_user_id, b.demand_window_id, b.locality_key,
                                b.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,
                                b.vendor_name, b.portions, b.notes, b.status, b.commitment_status,
                                b.seeker_demand_id, b.order_code, b.email_share_consent_at,
                                b.created_at, b.updated_at
                         FROM vendor_bids b
                         LEFT JOIN standard_offers o ON o.standard_offer_id = b.standard_offer_id
                         WHERE b.order_code = $1 AND b.commitment_status = 'committed'
                         ORDER BY b.updated_at DESC
                         LIMIT 1
                        """,
                        List.of(orderCode),
                        this::vendorBidRowToRecord);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Override
    public List<Map<String, Object>> listPledges(int limit) {
        if (!enabled) {
            return List.of();
        }
        int capped = Math.min(Math.max(limit <= 0 ? 100 : limit, 1), 200);
        String consentCol =
                phase3.pledgeConsent()
                        ? "p.email_share_consent_at"
                        : "NULL::timestamptz AS email_share_consent_at";
        return query(
                "SELECT p.pledge_id, p.pledged_by_user_id, p.demand_window_id, p.locality_key,\n"
                        + "              p.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,\n"
                        + "              p.meal_units, p.status, "
                        + consentCol
                        + ", p.created_at, p.updated_at\n"
                        + "       FROM meal_pledges p\n"
                        + "       LEFT JOIN standard_offers o ON o.standard_offer_id = p.standard_offer_id\n"
                        + "       ORDER BY p.updated_at DESC\n"
                        + "       LIMIT $1",
                List.of(capped),
                this::pledgeRowToRecord);
    }

    @Override
    public List<Map<String, Object>> listVendorBids(int limit) {
        if (!enabled) {
            return List.of();
        }
        int capped = Math.min(Math.max(limit <= 0 ? 100 : limit, 1), 200);
        String commitmentCols =
                phase3.kitchenCommitment()
                        ? "b.commitment_status, b.seeker_demand_id, b.order_code, b.email_share_consent_at"
                        : "'submitted'::text AS commitment_status, NULL::text AS seeker_demand_id,\n"
                                + "         NULL::text AS order_code, NULL::timestamptz AS email_share_consent_at";
        return query(
                "SELECT b.vendor_bid_id, b.submitted_by_user_id, b.demand_window_id, b.locality_key,\n"
                        + "              b.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,\n"
                        + "              b.vendor_name, b.portions, b.notes, b.status,\n"
                        + "              "
                        + commitmentCols
                        + ", b.created_at, b.updated_at\n"
                        + "       FROM vendor_bids b\n"
                        + "       LEFT JOIN standard_offers o ON o.standard_offer_id = b.standard_offer_id\n"
                        + "       ORDER BY b.updated_at DESC\n"
                        + "       LIMIT $1",
                List.of(capped),
                this::vendorBidRowToRecord);
    }

    @Override
    public List<Map<String, Object>> listStandardOffers(String localityKey) {
        if (!enabled) {
            return List.of();
        }
        String trimmed = localityKey == null ? "" : localityKey.trim();
        if (!trimmed.isEmpty()) {
            return query(
                    """
                    SELECT standard_offer_id, locality_key, menu_label, price_inr,
                            created_at, updated_at
                     FROM standard_offers
                     WHERE locality_key = $1
                     ORDER BY menu_label ASC
                    """,
                    List.of(trimmed),
                    this::standardOfferRowToRecord);
        }
        return query(
                """
                SELECT standard_offer_id, locality_key, menu_label, price_inr,
                        created_at, updated_at
                 FROM standard_offers
                 ORDER BY locality_key ASC, menu_label ASC
                """,
                List.of(),
                this::standardOfferRowToRecord);
    }

    @Override
    public Map<String, Object> getStandardOfferById(String standardOfferId) {
        if (!enabled || standardOfferId == null || standardOfferId.trim().isEmpty()) {
            return null;
        }
        List<Map<String, Object>> rows =
                query(
                        """
                        SELECT standard_offer_id, locality_key, menu_label, price_inr,
                                created_at, updated_at
                         FROM standard_offers
                         WHERE standard_offer_id = $1
                         LIMIT 1
                        """,
                        List.of(standardOfferId.trim()),
                        this::standardOfferRowToRecord);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Object> pledgeRowToRecord(Map<String, Object> row) {
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", row.get("pledge_id"));
        record.put("pledged_by_user_id", row.get("pledged_by_user_id"));
        record.put("demand_window_id", row.get("demand_window_id") != null ? row.get("demand_window_id") : "");
        record.put("locality_key", String.valueOf(row.getOrDefault("locality_key", "")));
        record.put("standard_offer_id", row.get("standard_offer_id"));
        record.put("menu_label", String.valueOf(row.getOrDefault("menu_label", "")));
        Double units = SqlRecords.asFiniteDouble(row.get("meal_units"));
        record.put("meal_units", units == null ? 1 : (int) Math.round(units));
        record.put("status", row.get("status"));
        Object consent = row.get("email_share_consent_at");
        record.put("email_share_consent_at", consent == null ? null : SqlRecords.toIso(consent));
        record.put("created_at", SqlRecords.toIso(row.get("created_at")));
        record.put("updated_at", SqlRecords.toIso(row.get("updated_at")));
        return record;
    }

    private Map<String, Object> vendorBidRowToRecord(Map<String, Object> row) {
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", row.get("vendor_bid_id"));
        record.put("submitted_by_user_id", row.get("submitted_by_user_id"));
        record.put("demand_window_id", row.get("demand_window_id") != null ? row.get("demand_window_id") : "");
        record.put("locality_key", String.valueOf(row.getOrDefault("locality_key", "")));
        record.put("standard_offer_id", row.get("standard_offer_id"));
        record.put("menu_label", String.valueOf(row.getOrDefault("menu_label", "")));
        record.put("vendor_name", String.valueOf(row.getOrDefault("vendor_name", "")));
        Double portions = SqlRecords.asFiniteDouble(row.get("portions"));
        record.put("portions", portions == null ? 1 : (int) Math.round(portions));
        record.put("notes", row.get("notes") != null ? row.get("notes") : "");
        record.put("status", row.get("status"));
        record.put(
                "commitment_status",
                row.get("commitment_status") != null ? row.get("commitment_status") : "submitted");
        record.put("seeker_demand_id", row.get("seeker_demand_id"));
        record.put("order_code", row.get("order_code"));
        Object consent = row.get("email_share_consent_at");
        record.put("email_share_consent_at", consent == null ? null : SqlRecords.toIso(consent));
        record.put("created_at", SqlRecords.toIso(row.get("created_at")));
        record.put("updated_at", SqlRecords.toIso(row.get("updated_at")));
        return record;
    }

    private Map<String, Object> standardOfferRowToRecord(Map<String, Object> row) {
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", row.get("standard_offer_id"));
        record.put("locality_key", String.valueOf(row.getOrDefault("locality_key", "")));
        record.put("menu_label", String.valueOf(row.getOrDefault("menu_label", "")));
        Object price = row.get("price_inr");
        record.put("price_inr", price == null || "".equals(price) ? null : SqlRecords.asFiniteDouble(price));
        record.put("created_at", SqlRecords.toIso(row.get("created_at")));
        record.put("updated_at", SqlRecords.toIso(row.get("updated_at")));
        return record;
    }

    private void execute(String sql, List<Object> values) {
        PgParams.Converted converted = PgParams.convert(sql, values);
        jdbc.update(converted.sql(), converted.args());
    }

    private List<Map<String, Object>> query(
            String sql, List<Object> values, java.util.function.Function<Map<String, Object>, Map<String, Object>> mapper) {
        PgParams.Converted converted = PgParams.convert(sql, values);
        return jdbc.query(
                converted.sql(),
                (rs, i) -> mapper.apply(SqlRecords.rowMap(rs)),
                converted.args());
    }

    private static String trimToNull(Object value) {
        if (!(value instanceof String text)) {
            return value == null ? null : String.valueOf(value).trim().isEmpty() ? null : String.valueOf(value).trim();
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
