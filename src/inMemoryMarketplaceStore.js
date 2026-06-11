import { pilotOfferRecords } from "./pilotStandardOffers.js";

/** Test / local fallback when Postgres marketplace tables are not wired. */
export class InMemoryMarketplaceStore {
  constructor({ seedPilotOffers = true } = {}) {
    this.pledges = [];
    this.vendorBids = [];
    this.standardOffers = seedPilotOffers ? pilotOfferRecords() : [];
    this.enabled = true;
  }

  async insertPledge(record) {
    this.pledges.unshift(record);
    return record;
  }

  async insertVendorBid(record) {
    this.vendorBids.unshift(record);
    return record;
  }

  async listPledges({ limit = 100 } = {}) {
    return this.pledges.slice(0, limit);
  }

  async listVendorBids({ limit = 100 } = {}) {
    return this.vendorBids.slice(0, limit);
  }

  async listStandardOffers({ localityKey = null } = {}) {
    const trimmed = String(localityKey ?? "").trim();
    const offers = [...this.standardOffers];
    if (!trimmed) {
      return offers;
    }
    return offers.filter((offer) => offer.locality_key === trimmed);
  }

  async getStandardOfferById(standardOfferId) {
    const trimmed = String(standardOfferId ?? "").trim();
    if (!trimmed) {
      return null;
    }
    return (
      this.standardOffers.find((offer) => offer.id === trimmed) ?? null
    );
  }
}
