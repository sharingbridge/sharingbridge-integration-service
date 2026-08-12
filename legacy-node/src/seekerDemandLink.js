/** Link a kitchen commitment to the newest matching seeker demand (same area + menu). */
export async function enrichVendorBidWithSeekerDemand(
  record,
  seekerDemandStore
) {
  if (!seekerDemandStore?.listRecent || record.order_code) {
    return record;
  }
  const rows = await seekerDemandStore.listRecent({ limit: 100 });
  const locality = String(record.locality_key ?? "").trim();
  const offerId = String(record.standard_offer_id ?? "").trim();
  const match = rows.find(
    (row) =>
      String(row.locality_key ?? "").trim() === locality &&
      String(row.standard_offer_id ?? "").trim() === offerId &&
      row.order_code
  );
  if (!match) {
    return record;
  }
  return {
    ...record,
    seeker_demand_id: match.id,
    order_code: match.order_code,
    commitment_status: record.commitment_status ?? "committed"
  };
}

export function connectionNotifyRecipientIds({
  seekerDemand,
  kitchenCommitment,
  pledgeRecords
}) {
  const ids = new Set();
  if (seekerDemand?.reported_by_user_id) {
    ids.add(seekerDemand.reported_by_user_id);
  }
  if (kitchenCommitment?.submitted_by_user_id) {
    ids.add(kitchenCommitment.submitted_by_user_id);
  }
  for (const pledge of pledgeRecords) {
    if (pledge.pledged_by_user_id) {
      ids.add(pledge.pledged_by_user_id);
    }
  }
  return [...ids];
}
