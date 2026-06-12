import { fixtureStandardOfferRecords } from "../fixtures/standardOffersCatalog.js";

/** In-memory marketplace for route tests — not used in production (Postgres only). */
export class InMemoryMarketplaceStore {
  constructor({ seedStandardOffers = true } = {}) {
    this.pledges = [];
    this.vendorBids = [];
    this.standardOffers = seedStandardOffers ? fixtureStandardOfferRecords() : [];
    this.enabled = true;
    this.offersWired = true;
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
