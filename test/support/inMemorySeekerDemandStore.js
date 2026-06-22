import {
  applyLocationToRecord,
  locationFromPayload
} from "../../src/orderIntentLocation.js";

/** In-memory seeker demands for route tests — not used in production. */
export class InMemorySeekerDemandStore {
  constructor() {
    this.enabled = true;
    this.rows = [];
  }

  async init() {}

  async insertForReporter(reportedByUserId, record) {
    const withLocation = applyLocationToRecord(
      { ...record, reported_by_user_id: reportedByUserId },
      await locationFromPayload(record)
    );
    this.rows.unshift(withLocation);
    return withLocation;
  }

  async listRecent({ limit = 100, reporterUserIdFilter = null } = {}) {
    let list = [...this.rows];
    if (reporterUserIdFilter) {
      list = list.filter(
        (row) => row.reported_by_user_id === reporterUserIdFilter
      );
    }
    return list.slice(0, limit);
  }

  async findByOrderCode(orderCode) {
    const trimmed = String(orderCode ?? "").trim();
    if (!trimmed) {
      return null;
    }
    return this.rows.find((row) => row.order_code === trimmed) ?? null;
  }
}
