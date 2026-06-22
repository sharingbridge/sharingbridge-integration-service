import { fixtureStandardOfferRecords } from "../fixtures/standardOffersCatalog.js";

/** In-memory marketplace for route tests — not used in production. */
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

  async findKitchenCommitmentByOrderCode(orderCode) {
    const trimmed = String(orderCode ?? "").trim();
    if (!trimmed) {
      return null;
    }
    return (
      this.vendorBids.find(
        (row) =>
          row.order_code === trimmed && row.commitment_status === "committed"
      ) ?? null
    );
  }

  async listPledgesByOrderCode(orderCode) {
    const demand = await this.findSeekerDemandByOrderCode?.(orderCode);
    if (!demand?.locality_key) {
      return [];
    }
    return this.pledges.filter(
      (row) => row.locality_key === demand.locality_key
    );
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
