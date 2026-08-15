package org.sharingbridge.integration.repository;

import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;

public class DonorEmailLookup {

    private final JdbcTemplate jdbc;

    public DonorEmailLookup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, String> lookupByUserId(List<String> userIds) {
        Map<String, String> map = new LinkedHashMap<>();
        if (jdbc == null || userIds == null || userIds.isEmpty()) {
            return map;
        }
        Set<String> unique = new LinkedHashSet<>();
        for (String id : userIds) {
            if (id != null && !id.trim().isEmpty()) {
                unique.add(id.trim());
            }
        }
        if (unique.isEmpty()) {
            return map;
        }
        try {
            jdbc.query(
                    connection -> {
                        PreparedStatement ps =
                                connection.prepareStatement(
                                        "SELECT id, email FROM users WHERE id = ANY(?::text[])");
                        Array array = connection.createArrayOf("text", unique.toArray(String[]::new));
                        ps.setArray(1, array);
                        return ps;
                    },
                    (ResultSet rs) -> {
                        while (rs.next()) {
                            String email = rs.getString("email");
                            if (email != null && !email.trim().isEmpty()) {
                                map.put(rs.getString("id"), email.trim());
                            }
                        }
                        return map;
                    });
        } catch (RuntimeException ignored) {
            return new LinkedHashMap<>();
        }
        return map;
    }
}
