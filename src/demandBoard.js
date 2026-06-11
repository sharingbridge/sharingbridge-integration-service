import {
  aggregateDemandByStandardOffer,
  formatSeekerDemandForApi
} from "./seekerDemands.js";
import { formatStandardOfferForApi } from "./standardOffers.js";

/**
 * Phase C.1 — demand board from persisted seeker_demands (+ vendor bids later).
 */
import {
  activeOfferBucketsFromSeekerDemands,
  enrichDemandWindowsWithSupply,
  formatPledgeForApi,
  formatVendorBidForApi,
  tagMarketplaceOfferMatch
} from "./marketplace.js";

export async function resolveActiveOfferBuckets(seekerDemandStore) {
  if (!seekerDemandStore || seekerDemandStore.enabled === false) {
    return [];
  }
  const rows = await seekerDemandStore.listRecent({ limit: 100 });
  return activeOfferBucketsFromSeekerDemands(
    rows.map(formatSeekerDemandForApi)
  );
}

export async function buildDemandBoardSnapshot({
  role,
  seekerDemandStore,
  marketplaceStore
} = {}) {
  const rows = seekerDemandStore
    ? await seekerDemandStore.listRecent({ limit: 100 })
    : [];
  const formatted = rows.map(formatSeekerDemandForApi);
  const schemaReady = seekerDemandStore?.enabled !== false;
  const activeOfferBuckets = activeOfferBucketsFromSeekerDemands(formatted);
  const pledgesRaw = marketplaceStore
    ? (await marketplaceStore.listPledges({ limit: 100 })).map(formatPledgeForApi)
    : [];
  const vendorBidsRaw = marketplaceStore
    ? (await marketplaceStore.listVendorBids({ limit: 100 })).map(
        formatVendorBidForApi
      )
    : [];
  const pledges = tagMarketplaceOfferMatch(pledgesRaw, activeOfferBuckets);
  const vendorBids = tagMarketplaceOfferMatch(
    vendorBidsRaw,
    activeOfferBuckets
  );
  const windows = enrichDemandWindowsWithSupply(
    aggregateDemandByStandardOffer(formatted),
    pledgesRaw,
    vendorBidsRaw
  );
  const orphanPledges = pledges.filter((row) => !row.matches_demand_bucket);
  const orphanVendorBids = vendorBids.filter((row) => !row.matches_demand_bucket);
  const standardOffers = marketplaceStore
    ? (await marketplaceStore.listStandardOffers()).map(formatStandardOfferForApi)
    : [];
  const marketplaceLive = marketplaceStore?.enabled !== false;

  return {
    status: schemaReady ? "live_seeker_demands" : "schema_pending",
    role: role ?? null,
    message: schemaReady
      ? marketplaceLive
        ? "Seeker demands, pledges, and vendor bids persist in Postgres. Gaps and allocation hints are computed; auto-assign and donor notify are not live yet."
        : "Seeker demands recorded. Run schema-marketplace-migration.sql for pledges and vendor bids."
      : "Run schema-seeker-demands-migration.sql in Supabase to enable seeker demand recording.",
    standard_offers: standardOffers,
    demand_windows: windows,
    active_offer_buckets: activeOfferBuckets,
    active_locality_keys: [
      ...new Set(activeOfferBuckets.map((bucket) => bucket.locality_key))
    ],
    seeker_demands: formatted,
    pledges,
    vendor_bids: vendorBids,
    orphan_pledges: orphanPledges,
    orphan_vendor_bids: orphanVendorBids,
    generated_at: new Date().toISOString()
  };
}
