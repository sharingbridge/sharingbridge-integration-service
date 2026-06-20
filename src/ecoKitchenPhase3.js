/** Probe Phase 3 columns (order codes, consent) — graceful before migration. */

export async function probeEcoKitchenPhase3(pool) {
  if (!pool) {
    return {
      orderCodes: false,
      pledgeConsent: false,
      kitchenCommitment: false,
      deliveryTimestamp: false
    };
  }
  const flags = {
    orderCodes: false,
    pledgeConsent: false,
    kitchenCommitment: false,
    deliveryTimestamp: false
  };
  try {
    await pool.query(
      "SELECT order_code, initiation_route FROM order_intents LIMIT 0"
    );
    await pool.query(
      "SELECT order_code, initiation_route FROM seeker_demands LIMIT 0"
    );
    flags.orderCodes = true;
  } catch {
    // migration not applied
  }
  try {
    await pool.query("SELECT email_share_consent_at FROM meal_pledges LIMIT 0");
    flags.pledgeConsent = true;
  } catch {
    // migration not applied
  }
  try {
    await pool.query(
      "SELECT email_share_consent_at, order_code, commitment_status FROM vendor_bids LIMIT 0"
    );
    flags.kitchenCommitment = true;
  } catch {
    // migration not applied
  }
  try {
    await pool.query("SELECT delivered_at FROM seeker_demands LIMIT 0");
    flags.deliveryTimestamp = true;
  } catch {
    // migration not applied
  }
  return flags;
}
