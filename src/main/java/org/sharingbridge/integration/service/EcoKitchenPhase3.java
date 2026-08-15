package org.sharingbridge.integration.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

public final class EcoKitchenPhase3 {

    private static final Logger log = LoggerFactory.getLogger(EcoKitchenPhase3.class);

    public record Flags(
            boolean orderCodes,
            boolean pledgeConsent,
            boolean kitchenCommitment,
            boolean deliveryTimestamp) {
        public static Flags none() {
            return new Flags(false, false, false, false);
        }
    }

    private EcoKitchenPhase3() {}

    public static Flags probe(JdbcTemplate jdbc) {
        if (jdbc == null) {
            return Flags.none();
        }
        boolean orderCodes = false;
        boolean pledgeConsent = false;
        boolean kitchenCommitment = false;
        boolean deliveryTimestamp = false;
        try {
            jdbc.execute("SELECT order_code, initiation_route FROM order_intents LIMIT 0");
            jdbc.execute("SELECT order_code, initiation_route FROM seeker_demands LIMIT 0");
            orderCodes = true;
        } catch (DataAccessException ignored) {
            // migration not applied
        }
        try {
            jdbc.execute("SELECT email_share_consent_at FROM meal_pledges LIMIT 0");
            pledgeConsent = true;
        } catch (DataAccessException ignored) {
            // migration not applied
        }
        try {
            jdbc.execute(
                    "SELECT email_share_consent_at, order_code, commitment_status FROM vendor_bids LIMIT 0");
            kitchenCommitment = true;
        } catch (DataAccessException ignored) {
            // migration not applied
        }
        try {
            jdbc.execute("SELECT delivered_at FROM seeker_demands LIMIT 0");
            deliveryTimestamp = true;
        } catch (DataAccessException ignored) {
            // migration not applied
        }
        log.debug(
                "EcoKitchenPhase3 probe orderCodes={} pledgeConsent={} kitchenCommitment={} deliveryTimestamp={}",
                orderCodes,
                pledgeConsent,
                kitchenCommitment,
                deliveryTimestamp);
        return new Flags(orderCodes, pledgeConsent, kitchenCommitment, deliveryTimestamp);
    }
}
