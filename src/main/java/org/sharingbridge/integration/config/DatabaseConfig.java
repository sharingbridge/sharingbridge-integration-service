package org.sharingbridge.integration.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sharingbridge.integration.geo.GeoSql;
import org.sharingbridge.integration.repository.DeviceTokenRepository;
import org.sharingbridge.integration.repository.DonorEmailLookup;
import org.sharingbridge.integration.repository.MarketplaceRepository;
import org.sharingbridge.integration.repository.MarketplaceStore;
import org.sharingbridge.integration.repository.OrderIntentRepository;
import org.sharingbridge.integration.repository.OrderIntentStore;
import org.sharingbridge.integration.repository.SeekerDemandRepository;
import org.sharingbridge.integration.repository.SeekerDemandStore;
import org.sharingbridge.integration.repository.SqlRecords;
import org.sharingbridge.integration.service.EcoKitchenPhase3;
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
            if (SqlRecords.isUndefinedTable(ex)) {
                enabled = false;
                log.warn(
                        "device_tokens table is not present; PUT /v1/device-tokens will return 503 until migration runs.");
            } else {
                throw ex;
            }
        }
        return new DeviceTokenRepository(jdbcTemplate, enabled);
    }

    @Bean
    public OrderIntentStore orderIntentStore(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        String gisSchema = GeoSql.resolveGisSchema();
        EcoKitchenPhase3.Flags phase3 = EcoKitchenPhase3.probe(jdbcTemplate);
        return new OrderIntentRepository(jdbcTemplate, objectMapper, gisSchema, phase3);
    }

    @Bean
    public SeekerDemandStore seekerDemandStore(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        boolean enabled = true;
        try {
            jdbcTemplate.execute("SELECT 1 FROM seeker_demands LIMIT 1");
        } catch (DataAccessException ex) {
            if (SqlRecords.isUndefinedTable(ex)) {
                enabled = false;
                log.warn("seeker_demands table is not present; seeker-demand APIs stay disabled until migration runs.");
            } else {
                throw ex;
            }
        }
        EcoKitchenPhase3.Flags phase3 = enabled ? EcoKitchenPhase3.probe(jdbcTemplate) : EcoKitchenPhase3.Flags.none();
        String gisSchema = GeoSql.resolveGisSchema();
        return new SeekerDemandRepository(jdbcTemplate, objectMapper, gisSchema, enabled, phase3);
    }

    @Bean
    public MarketplaceStore marketplaceStore(JdbcTemplate jdbcTemplate) {
        boolean enabled = true;
        try {
            jdbcTemplate.execute("SELECT 1 FROM meal_pledges LIMIT 1");
            jdbcTemplate.execute("SELECT 1 FROM vendor_bids LIMIT 1");
            jdbcTemplate.execute("SELECT standard_offer_id FROM meal_pledges LIMIT 0");
            jdbcTemplate.execute("SELECT standard_offer_id FROM vendor_bids LIMIT 0");
            jdbcTemplate.execute("SELECT 1 FROM standard_offers LIMIT 1");
        } catch (DataAccessException ex) {
            if (SqlRecords.isUndefinedTable(ex)) {
                enabled = false;
                log.warn(
                        "Marketplace tables are not present; marketplace APIs stay disabled until migration runs.");
            } else {
                throw ex;
            }
        }
        EcoKitchenPhase3.Flags phase3 = enabled ? EcoKitchenPhase3.probe(jdbcTemplate) : EcoKitchenPhase3.Flags.none();
        return new MarketplaceRepository(jdbcTemplate, enabled, phase3);
    }

    @Bean
    public DonorEmailLookup donorEmailLookup(JdbcTemplate jdbcTemplate) {
        return new DonorEmailLookup(jdbcTemplate);
    }
}
