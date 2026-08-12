package org.sharingbridge.integration.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sharingbridge.integration.repository.DeviceTokenRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class DatabaseConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Bean
    public DataAccessProperties dataAccessProperties() {
        return DataAccessProperties.fromEnvironment();
    }

    @Bean
    public DataSource dataSource(DataAccessProperties dataAccess) {
        String databaseUrl = System.getenv("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            throw new IllegalStateException("DATABASE_URL is required.");
        }

        DataAccessProperties.JdbcParts parts = dataAccess.toJdbcParts(databaseUrl);
        log.info(
                "Postgres JDBC ready; pooling={}; poolMax={}; supabasePoolPort={}",
                dataAccess.isPooling(),
                dataAccess.getPoolMax(),
                dataAccess.getSupabasePoolPort().port());

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(parts.url());
        config.setUsername(parts.username());
        config.setPassword(parts.password());
        config.setMaximumPoolSize(Math.max(dataAccess.getPoolMin(), dataAccess.getPoolMax()));
        config.setMinimumIdle(dataAccess.getPoolMin());
        config.setIdleTimeout(dataAccess.getConnectionIdleLifetimeSeconds() * 1000L);
        config.setConnectionTimeout(dataAccess.getTimeoutSeconds() * 1000L);
        config.setPoolName("integration-hikari");
        if (!dataAccess.isPooling()) {
            config.setMaximumPoolSize(1);
            config.setMinimumIdle(0);
        }
        return new HikariDataSource(config);
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    public DeviceTokenRepository deviceTokenRepository(JdbcTemplate jdbcTemplate) {
        boolean enabled = true;
        try {
            jdbcTemplate.execute("SELECT 1 FROM device_tokens LIMIT 1");
        } catch (DataAccessException ex) {
            String message = String.valueOf(ex.getMostSpecificCause().getMessage()).toLowerCase();
            if (message.contains("device_tokens")
                    && (message.contains("does not exist")
                            || message.contains("undefined_table")
                            || message.contains("42p01"))) {
                enabled = false;
                log.warn(
                        "device_tokens table is not present; PUT /v1/device-tokens will return 503 until migration runs.");
            } else {
                throw ex;
            }
        }
        return new DeviceTokenRepository(jdbcTemplate, enabled);
    }
}
