/** Test / local fallback when Postgres marketplace tables are not wired. */
export class InMemoryMarketplaceStore {
  constructor() {
    this.pledges = [];
    this.vendorBids = [];
    this.standardOffers = [];
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

  async listStandardOffers() {
    return [...this.standardOffers];
  }
}
