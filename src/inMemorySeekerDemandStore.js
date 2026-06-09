import {
  applyLocationToRecord,
  locationFromPayload
} from "./orderIntentLocation.js";

/** Test / local fallback when Postgres seeker_demands is not wired. */
export class InMemorySeekerDemandStore {
  constructor() {
    this.enabled = true;
    this.rows = [];
  }

  async init() {}

  async insertForReporter(reportedByUserId, record) {
    const withLocation = applyLocationToRecord(
      { ...record, reported_by_user_id: reportedByUserId },
      locationFromPayload(record)
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
}
