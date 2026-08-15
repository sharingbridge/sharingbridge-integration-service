package org.sharingbridge.integration.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.dao.DataAccessException;

public final class SqlRecords {

    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE =
            new TypeReference<>() {};

    private SqlRecords() {}

    public static Map<String, Object> rowMap(ResultSet resultSet) throws SQLException {
        ResultSetMetaData meta = resultSet.getMetaData();
        Map<String, Object> row = new LinkedHashMap<>();
        for (int i = 1; i <= meta.getColumnCount(); i++) {
            row.put(meta.getColumnLabel(i), resultSet.getObject(i));
        }
        return row;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> jsonMap(Object raw, ObjectMapper mapper) {
        if (raw == null) {
            return new LinkedHashMap<>();
        }
        if (raw instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((key, value) -> out.put(String.valueOf(key), value));
            return out;
        }
        String json = extractJson(raw);
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return mapper.readValue(json, MAP_TYPE);
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }

    public static String toIso(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (value instanceof Instant instant) {
            return instant.toString();
        }
        if (value instanceof OffsetDateTime offsetDateTime) {
            return offsetDateTime.toInstant().toString();
        }
        if (value instanceof java.util.Date date) {
            return date.toInstant().toString();
        }
        String trimmed = String.valueOf(value).trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static Double asFiniteDouble(Object value) {
        if (!(value instanceof Number number)) {
            return null;
        }
        double n = number.doubleValue();
        return Double.isFinite(n) ? n : null;
    }

    public static Integer asRoundedInt(Object value) {
        Double n = asFiniteDouble(value);
        return n == null ? null : (int) Math.round(n);
    }

    public static boolean isUndefinedTable(DataAccessException ex) {
        Throwable cause = ex.getMostSpecificCause();
        if (cause instanceof SQLException sql) {
            String state = sql.getSQLState();
            if ("42P01".equalsIgnoreCase(state)) {
                return true;
            }
        }
        String message = String.valueOf(cause.getMessage()).toLowerCase();
        return message.contains("does not exist")
                || message.contains("undefined_table")
                || message.contains("42p01");
    }

    public static boolean isUndefinedFunction(DataAccessException ex) {
        Throwable cause = ex.getMostSpecificCause();
        if (cause instanceof SQLException sql) {
            String state = sql.getSQLState();
            if ("42883".equals(state) || "42704".equals(state)) {
                return true;
            }
        }
        String message = String.valueOf(cause.getMessage()).toLowerCase();
        return message.contains("42883") || message.contains("42704");
    }

    private static String extractJson(Object raw) {
        try {
            var method = raw.getClass().getMethod("getValue");
            Object value = method.invoke(raw);
            return value == null ? null : String.valueOf(value);
        } catch (ReflectiveOperationException ignored) {
            return String.valueOf(raw);
        }
    }
}
