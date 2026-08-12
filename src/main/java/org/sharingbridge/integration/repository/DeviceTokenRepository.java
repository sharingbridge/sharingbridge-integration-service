package org.sharingbridge.integration.repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

public class DeviceTokenRepository {

    private final JdbcTemplate jdbc;
    private final boolean enabled;

    public DeviceTokenRepository(JdbcTemplate jdbc, boolean enabled) {
        this.jdbc = jdbc;
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public Map<String, Object> upsertForUser(String userId, Map<String, Object> record) {
        if (!enabled) {
            throw unavailableError();
        }
        Instant updatedAt = Instant.parse(String.valueOf(record.get("updated_at")));
        try {
            jdbc.update(
                    """
                    INSERT INTO device_tokens (user_id, fcm_token, platform, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (user_id, fcm_token) DO UPDATE SET
                      platform = EXCLUDED.platform,
                      updated_at = EXCLUDED.updated_at
                    """,
                    userId,
                    record.get("fcm_token"),
                    record.get("platform"),
                    Timestamp.from(updatedAt));
            return record;
        } catch (DataAccessException ex) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "internal_error",
                    ex.getMostSpecificCause().getMessage());
        }
    }

    public static ApiException unavailableError() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "device_tokens_schema_missing",
                "device_tokens table is not present. Run schema-device-tokens-migration.sql.");
    }
}
