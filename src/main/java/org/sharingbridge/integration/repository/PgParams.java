package org.sharingbridge.integration.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Convert Postgres {@code $n} placeholders (reusable) to JDBC {@code ?} (positional).
 */
public final class PgParams {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\$(\\d+)");

    private PgParams() {}

    public record Converted(String sql, Object[] args) {}

    public static Converted convert(String pgSql, List<Object> values) {
        Matcher matcher = PLACEHOLDER.matcher(pgSql);
        StringBuilder sql = new StringBuilder();
        List<Object> args = new ArrayList<>();
        while (matcher.find()) {
            int index = Integer.parseInt(matcher.group(1));
            args.add(values.get(index - 1));
            matcher.appendReplacement(sql, "?");
        }
        matcher.appendTail(sql);
        return new Converted(sql.toString(), args.toArray());
    }
}
