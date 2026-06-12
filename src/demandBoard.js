import { recordMatchesLocalityFilter } from "./localityKey.js";
import {
  aggregateDemandByStandardOffer,
  formatSeekerDemandForApi
} from "./seekerDemands.js";
import { formatStandardOfferForApi } from "./standardOffers.js";
import { intentMatchesNeighbourhood } from "./neighbourhoodFilter.js";

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

function filterRowsBySince(rows, sinceMs) {
  if (!sinceMs) {
    return rows;
  }
  const cutoff = Date.now() - sinceMs;
  return rows.filter((row) => {
    const raw = row.updated_at || row.created_at;
    const ms = Date.parse(raw || "");
    return !Number.isNaN(ms) && ms >= cutoff;
  });
}

function demandRowMatchesNeighbourhood(row, scope, viewerLocalityKey = null) {
  if (!scope) {
    return true;
  }
  if (scope.type === "locality") {
    return recordMatchesLocalityFilter(row.locality_key, scope.localityKey);
  }
  if (row.location_lat != null && row.location_lng != null) {
    return intentMatchesNeighbourhood(
      {
        locality_key: row.locality_key,
        location_lat: row.location_lat,
        location_lng: row.location_lng
      },
      scope
    );
  }
  if (viewerLocalityKey) {
    return recordMatchesLocalityFilter(row.locality_key, viewerLocalityKey);
  }
  return false;
}

function filterRowsByNeighbourhood(rows, scope, viewerLocalityKey = null) {
  if (!scope) {
    return rows;
  }
  return rows.filter((row) =>
    demandRowMatchesNeighbourhood(row, scope, viewerLocalityKey)
  );
}

export async function buildDemandBoardSnapshot({
  role,
  seekerDemandStore,
  marketplaceStore,
  sinceMs = null,
  neighbourhoodScope = null,
  viewerLocalityKey = null
} = {}) {
  const rows = seekerDemandStore
    ? await seekerDemandStore.listRecent({ limit: 100 })
    : [];
  let formatted = rows.map(formatSeekerDemandForApi);
  formatted = filterRowsBySince(formatted, sinceMs);
  formatted = filterRowsByNeighbourhood(
    formatted,
    neighbourhoodScope,
    viewerLocalityKey
  );
  const schemaReady = seekerDemandStore?.enabled !== false;
  const activeOfferBuckets = activeOfferBucketsFromSeekerDemands(formatted);
  let pledgesRaw = marketplaceStore
    ? (await marketplaceStore.listPledges({ limit: 100 })).map(formatPledgeForApi)
    : [];
  let vendorBidsRaw = marketplaceStore
    ? (await marketplaceStore.listVendorBids({ limit: 100 })).map(
        formatVendorBidForApi
      )
    : [];
  pledgesRaw = filterRowsBySince(pledgesRaw, sinceMs);
  vendorBidsRaw = filterRowsBySince(vendorBidsRaw, sinceMs);
  pledgesRaw = filterRowsByNeighbourhood(
    pledgesRaw,
    neighbourhoodScope,
    viewerLocalityKey
  );
  vendorBidsRaw = filterRowsByNeighbourhood(
    vendorBidsRaw,
    neighbourhoodScope,
    viewerLocalityKey
  );
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
        ? "Seeker demands, pledges, and vendor bids are loaded from Postgres. Allocation hints are computed; auto-assign is not live yet."
        : "Seeker demands are available; marketplace pledge and vendor-bid tables are not configured."
      : "Seeker demand storage is not configured.",
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
