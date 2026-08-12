import pg from "pg";
import { probeEcoKitchenPhase3 } from "./ecoKitchenPhase3.js";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function pledgeRowToRecord(row) {
  return {
    id: row.pledge_id,
    pledged_by_user_id: row.pledged_by_user_id,
    demand_window_id: row.demand_window_id ?? "",
    locality_key: String(row.locality_key ?? ""),
    standard_offer_id: row.standard_offer_id ?? null,
    menu_label: String(row.menu_label ?? ""),
    meal_units: Number(row.meal_units) || 1,
    status: row.status,
    email_share_consent_at:
      row.email_share_consent_at == null
        ? null
        : toIso(row.email_share_consent_at),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  };
}

function vendorBidRowToRecord(row) {
  return {
    id: row.vendor_bid_id,
    submitted_by_user_id: row.submitted_by_user_id,
    demand_window_id: row.demand_window_id ?? "",
    locality_key: String(row.locality_key ?? ""),
    standard_offer_id: row.standard_offer_id ?? null,
    menu_label: String(row.menu_label ?? ""),
    vendor_name: String(row.vendor_name ?? ""),
    portions: Number(row.portions) || 1,
    notes: row.notes ?? "",
    status: row.status,
    commitment_status: row.commitment_status ?? "submitted",
    seeker_demand_id: row.seeker_demand_id ?? null,
    order_code: row.order_code ?? null,
    email_share_consent_at:
      row.email_share_consent_at == null
        ? null
        : toIso(row.email_share_consent_at),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  };
}

function standardOfferRowToRecord(row) {
  return {
    id: row.standard_offer_id,
    locality_key: String(row.locality_key ?? ""),
    menu_label: String(row.menu_label ?? ""),
    price_inr:
      row.price_inr == null || row.price_inr === ""
        ? null
        : Number(row.price_inr),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  };
}

export class SqlMarketplaceStore {
  constructor(pool, { enabled = true, phase3 = null } = {}) {
    this.pool = pool;
    this.enabled = enabled;
    this.phase3 = phase3 ?? {
      orderCodes: false,
      pledgeConsent: false,
      kitchenCommitment: false
    };
  }

  static async create(connectionString) {
    if (!isNonEmptyString(connectionString)) {
      throw new Error("DATABASE_URL is required for SqlMarketplaceStore.");
    }
    const pool = new pg.Pool({ connectionString: connectionString.trim() });
    const client = await pool.connect();
    let enabled = true;
    try {
      await client.query("SELECT 1");
      await client.query("SELECT 1 FROM meal_pledges LIMIT 1");
      await client.query("SELECT 1 FROM vendor_bids LIMIT 1");
      await client.query("SELECT standard_offer_id FROM meal_pledges LIMIT 0");
      await client.query("SELECT standard_offer_id FROM vendor_bids LIMIT 0");
      await client.query("SELECT 1 FROM standard_offers LIMIT 1");
    } catch (error) {
      if (error?.code === "42P01") {
        enabled = false;
      } else {
        throw error;
      }
    } finally {
      client.release();
    }
    const phase3 = enabled ? await probeEcoKitchenPhase3(pool) : null;
    return new SqlMarketplaceStore(pool, { enabled, phase3 });
  }

  async init() {}

  unavailableError() {
    const error = new Error(
      "Marketplace tables (meal_pledges, vendor_bids, or standard_offers) are not present."
    );
    error.status = 503;
    error.code = "marketplace_schema_missing";
    return error;
  }

  async insertPledge(record) {
    if (!this.enabled) {
      throw this.unavailableError();
    }
    const demandWindowId = record.demand_window_id?.trim() || null;
    if (this.phase3?.pledgeConsent) {
      await this.pool.query(
        `INSERT INTO meal_pledges (
           pledge_id, pledged_by_user_id, demand_window_id, locality_key,
           standard_offer_id, meal_units, status, email_share_consent_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10)`,
        [
          record.id,
          record.pledged_by_user_id,
          demandWindowId,
          record.locality_key,
          record.standard_offer_id ?? null,
          record.meal_units,
          record.status,
          record.email_share_consent_at ?? null,
          record.created_at,
          record.updated_at
        ]
      );
    } else {
      await this.pool.query(
        `INSERT INTO meal_pledges (
           pledge_id, pledged_by_user_id, demand_window_id, locality_key,
           standard_offer_id, meal_units, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          record.id,
          record.pledged_by_user_id,
          demandWindowId,
          record.locality_key,
          record.standard_offer_id ?? null,
          record.meal_units,
          record.status,
          record.created_at,
          record.updated_at
        ]
      );
    }
    return record;
  }

  async insertVendorBid(record) {
    if (!this.enabled) {
      throw this.unavailableError();
    }
    const demandWindowId = record.demand_window_id?.trim() || null;
    if (this.phase3?.kitchenCommitment) {
      await this.pool.query(
        `INSERT INTO vendor_bids (
           vendor_bid_id, submitted_by_user_id, demand_window_id, locality_key,
           standard_offer_id, vendor_name, portions, notes, status,
           email_share_consent_at, seeker_demand_id, order_code, commitment_status,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11, $12, $13, $14, $15)`,
        [
          record.id,
          record.submitted_by_user_id,
          demandWindowId,
          record.locality_key,
          record.standard_offer_id ?? null,
          record.vendor_name,
          record.portions,
          record.notes ?? "",
          record.status,
          record.email_share_consent_at ?? null,
          record.seeker_demand_id ?? null,
          record.order_code ?? null,
          record.commitment_status ?? "committed",
          record.created_at,
          record.updated_at
        ]
      );
    } else {
      await this.pool.query(
        `INSERT INTO vendor_bids (
           vendor_bid_id, submitted_by_user_id, demand_window_id, locality_key,
           standard_offer_id, vendor_name, portions, notes, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          record.id,
          record.submitted_by_user_id,
          demandWindowId,
          record.locality_key,
          record.standard_offer_id ?? null,
          record.vendor_name,
          record.portions,
          record.notes ?? "",
          record.status,
          record.created_at,
          record.updated_at
        ]
      );
    }
    return record;
  }

  async listPledgesByOrderCode(orderCode) {
    if (!this.enabled || !this.phase3?.kitchenCommitment || !orderCode) {
      return [];
    }
    const result = await this.pool.query(
      `SELECT p.pledge_id, p.pledged_by_user_id, p.demand_window_id, p.locality_key,
              p.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,
              p.meal_units, p.status, p.email_share_consent_at, p.created_at, p.updated_at
       FROM meal_pledges p
       LEFT JOIN standard_offers o ON o.standard_offer_id = p.standard_offer_id
       WHERE p.locality_key IN (
         SELECT locality_key FROM seeker_demands WHERE order_code = $1
       )
       ORDER BY p.updated_at DESC`,
      [orderCode]
    );
    return result.rows.map(pledgeRowToRecord);
  }

  async findKitchenCommitmentByOrderCode(orderCode) {
    if (!this.enabled || !this.phase3?.kitchenCommitment || !orderCode) {
      return null;
    }
    const result = await this.pool.query(
      `SELECT b.vendor_bid_id, b.submitted_by_user_id, b.demand_window_id, b.locality_key,
              b.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,
              b.vendor_name, b.portions, b.notes, b.status, b.commitment_status,
              b.seeker_demand_id, b.order_code, b.email_share_consent_at,
              b.created_at, b.updated_at
       FROM vendor_bids b
       LEFT JOIN standard_offers o ON o.standard_offer_id = b.standard_offer_id
       WHERE b.order_code = $1 AND b.commitment_status = 'committed'
       ORDER BY b.updated_at DESC
       LIMIT 1`,
      [orderCode]
    );
    return result.rowCount > 0 ? vendorBidRowToRecord(result.rows[0]) : null;
  }

  async listPledges({ limit = 100 } = {}) {
    if (!this.enabled) {
      return [];
    }
    const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const consentCol = this.phase3?.pledgeConsent
      ? "p.email_share_consent_at"
      : "NULL::timestamptz AS email_share_consent_at";
    const result = await this.pool.query(
      `SELECT p.pledge_id, p.pledged_by_user_id, p.demand_window_id, p.locality_key,
              p.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,
              p.meal_units, p.status, ${consentCol}, p.created_at, p.updated_at
       FROM meal_pledges p
       LEFT JOIN standard_offers o ON o.standard_offer_id = p.standard_offer_id
       ORDER BY p.updated_at DESC
       LIMIT $1`,
      [capped]
    );
    return result.rows.map(pledgeRowToRecord);
  }

  async listVendorBids({ limit = 100 } = {}) {
    if (!this.enabled) {
      return [];
    }
    const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const commitmentCols = this.phase3?.kitchenCommitment
      ? `b.commitment_status, b.seeker_demand_id, b.order_code, b.email_share_consent_at`
      : `'submitted'::text AS commitment_status, NULL::text AS seeker_demand_id,
         NULL::text AS order_code, NULL::timestamptz AS email_share_consent_at`;
    const result = await this.pool.query(
      `SELECT b.vendor_bid_id, b.submitted_by_user_id, b.demand_window_id, b.locality_key,
              b.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,
              b.vendor_name, b.portions, b.notes, b.status,
              ${commitmentCols}, b.created_at, b.updated_at
       FROM vendor_bids b
       LEFT JOIN standard_offers o ON o.standard_offer_id = b.standard_offer_id
       ORDER BY b.updated_at DESC
       LIMIT $1`,
      [capped]
    );
    return result.rows.map(vendorBidRowToRecord);
  }

  async listStandardOffers({ localityKey = null } = {}) {
    if (!this.enabled) {
      return [];
    }
    const trimmed = String(localityKey ?? "").trim();
    const result = trimmed
      ? await this.pool.query(
          `SELECT standard_offer_id, locality_key, menu_label, price_inr,
                  created_at, updated_at
           FROM standard_offers
           WHERE locality_key = $1
           ORDER BY menu_label ASC`,
          [trimmed]
        )
      : await this.pool.query(
          `SELECT standard_offer_id, locality_key, menu_label, price_inr,
                  created_at, updated_at
           FROM standard_offers
           ORDER BY locality_key ASC, menu_label ASC`
        );
    return result.rows.map(standardOfferRowToRecord);
  }

  async getStandardOfferById(standardOfferId) {
    if (!this.enabled || !isNonEmptyString(standardOfferId)) {
      return null;
    }
    const result = await this.pool.query(
      `SELECT standard_offer_id, locality_key, menu_label, price_inr,
              created_at, updated_at
       FROM standard_offers
       WHERE standard_offer_id = $1
       LIMIT 1`,
      [standardOfferId.trim()]
    );
    const row = result.rows[0];
    return row ? standardOfferRowToRecord(row) : null;
  }
}
