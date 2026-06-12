import pg from "pg";

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

export class PostgresMarketplaceStore {
  constructor(pool, { enabled = true, offersWired = true } = {}) {
    this.pool = pool;
    this.enabled = enabled;
    /** False when M1 ran without M2 (no standard_offer_id on pledges/bids). */
    this.offersWired = offersWired;
  }

  static async create(connectionString) {
    if (!isNonEmptyString(connectionString)) {
      throw new Error("DATABASE_URL is required for PostgresMarketplaceStore.");
    }
    const pool = new pg.Pool({ connectionString: connectionString.trim() });
    const client = await pool.connect();
    let enabled = true;
    let offersWired = true;
    try {
      await client.query("SELECT 1");
      await client.query("SELECT 1 FROM meal_pledges LIMIT 1");
      await client.query("SELECT 1 FROM vendor_bids LIMIT 1");
      try {
        await client.query("SELECT standard_offer_id FROM meal_pledges LIMIT 0");
        await client.query("SELECT standard_offer_id FROM vendor_bids LIMIT 0");
      } catch (error) {
        if (error?.code === "42703") {
          offersWired = false;
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (error?.code === "42P01") {
        enabled = false;
        offersWired = false;
      } else {
        throw error;
      }
    } finally {
      client.release();
    }
    return new PostgresMarketplaceStore(pool, { enabled, offersWired });
  }

  async init() {}

  unavailableError() {
    const error = new Error(
      "Marketplace tables missing. Run configuration/schema-marketplace-migration.sql in Supabase."
    );
    error.status = 503;
    error.code = "marketplace_schema_missing";
    return error;
  }

  offersNotWiredError() {
    const error = new Error(
      "Pledges and vendor bids need standard_offer_id columns. Run configuration/schema-standard-offers-wire-migration.sql in Supabase."
    );
    error.status = 503;
    error.code = "marketplace_offers_not_wired";
    return error;
  }

  async insertPledge(record) {
    if (!this.enabled) {
      throw this.unavailableError();
    }
    if (!this.offersWired) {
      throw this.offersNotWiredError();
    }
    const demandWindowId = record.demand_window_id?.trim() || null;
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
    return record;
  }

  async insertVendorBid(record) {
    if (!this.enabled) {
      throw this.unavailableError();
    }
    if (!this.offersWired) {
      throw this.offersNotWiredError();
    }
    const demandWindowId = record.demand_window_id?.trim() || null;
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
    return record;
  }

  async listPledges({ limit = 100 } = {}) {
    if (!this.enabled) {
      return [];
    }
    const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const sql = this.offersWired
      ? `SELECT p.pledge_id, p.pledged_by_user_id, p.demand_window_id, p.locality_key,
              p.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,
              p.meal_units, p.status, p.created_at, p.updated_at
         FROM meal_pledges p
         LEFT JOIN standard_offers o ON o.standard_offer_id = p.standard_offer_id
         ORDER BY p.updated_at DESC
         LIMIT $1`
      : `SELECT p.pledge_id, p.pledged_by_user_id, p.demand_window_id, p.locality_key,
              NULL::text AS standard_offer_id, ''::text AS menu_label,
              p.meal_units, p.status, p.created_at, p.updated_at
         FROM meal_pledges p
         ORDER BY p.updated_at DESC
         LIMIT $1`;
    const result = await this.pool.query(sql, [capped]);
    return result.rows.map(pledgeRowToRecord);
  }

  async listVendorBids({ limit = 100 } = {}) {
    if (!this.enabled) {
      return [];
    }
    const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const sql = this.offersWired
      ? `SELECT b.vendor_bid_id, b.submitted_by_user_id, b.demand_window_id, b.locality_key,
              b.standard_offer_id, COALESCE(o.menu_label, '') AS menu_label,
              b.vendor_name, b.portions, b.notes, b.status, b.created_at, b.updated_at
         FROM vendor_bids b
         LEFT JOIN standard_offers o ON o.standard_offer_id = b.standard_offer_id
         ORDER BY b.updated_at DESC
         LIMIT $1`
      : `SELECT b.vendor_bid_id, b.submitted_by_user_id, b.demand_window_id, b.locality_key,
              NULL::text AS standard_offer_id, ''::text AS menu_label,
              b.vendor_name, b.portions, b.notes, b.status, b.created_at, b.updated_at
         FROM vendor_bids b
         ORDER BY b.updated_at DESC
         LIMIT $1`;
    const result = await this.pool.query(sql, [capped]);
    return result.rows.map(vendorBidRowToRecord);
  }

  async listStandardOffers({ localityKey = null } = {}) {
    if (!this.enabled) {
      return [];
    }
    try {
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
    } catch (error) {
      if (error?.code === "42P01") {
        return [];
      }
      throw error;
    }
  }

  async getStandardOfferById(standardOfferId) {
    if (!this.enabled || !isNonEmptyString(standardOfferId)) {
      return null;
    }
    try {
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
    } catch (error) {
      if (error?.code === "42P01") {
        return null;
      }
      throw error;
    }
  }
}
