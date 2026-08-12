/** In-memory device tokens for route tests. */
export class InMemoryDeviceTokenStore {
  constructor() {
    this.rows = [];
    this.enabled = true;
  }

  async upsertForUser(userId, record) {
    this.rows = this.rows.filter(
      (row) => !(row.user_id === userId && row.fcm_token === record.fcm_token)
    );
    const saved = { ...record, user_id: userId };
    this.rows.push(saved);
    return saved;
  }

  async listTokensForUserIds(userIds) {
    const set = new Set(userIds);
    return this.rows.filter((row) => set.has(row.user_id));
  }
}
