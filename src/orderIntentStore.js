import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = "order-intents.json";

export class OrderIntentStore {
  constructor({ dataDir = DEFAULT_DATA_DIR } = {}) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, STORE_FILE);
    this.byUser = {};
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.byUser = parsed?.byUser && typeof parsed.byUser === "object"
        ? parsed.byUser
        : {};
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      this.byUser = {};
    }
  }

  async persist() {
    await fs.writeFile(
      this.filePath,
      JSON.stringify({ byUser: this.byUser }, null, 2),
      "utf8"
    );
  }

  _listForUser(userId) {
    if (!Array.isArray(this.byUser[userId])) {
      this.byUser[userId] = [];
    }
    return this.byUser[userId];
  }

  findByPackId(userId, packId) {
    const normalizedPackId =
      typeof packId === "string" ? packId.trim() : "";
    if (!normalizedPackId) {
      return null;
    }
    const list = this._listForUser(userId);
    return (
      list.find(
        (record) =>
          typeof record?.pack_id === "string" &&
          record.pack_id.trim() === normalizedPackId
      ) ?? null
    );
  }

  findById(userId, orderIntentId) {
    const normalizedId =
      typeof orderIntentId === "string" ? orderIntentId.trim() : "";
    if (!normalizedId) {
      return null;
    }
    const list = this._listForUser(userId);
    return list.find((record) => record?.id === normalizedId) ?? null;
  }

  async createForUser(userId, record) {
    this._listForUser(userId).push(record);
    return record;
  }

  /**
   * Create or update by pack_id. Preserves id and created_at on update.
   * @returns {{ record: object, created: boolean }}
   */
  async upsertForUser(userId, record) {
    const list = this._listForUser(userId);
    const packId =
      typeof record?.pack_id === "string" ? record.pack_id.trim() : "";
    const index = list.findIndex(
      (item) =>
        typeof item?.pack_id === "string" && item.pack_id.trim() === packId
    );
    if (index >= 0) {
      const existing = list[index];
      const updated = {
        ...existing,
        ...record,
        id: existing.id,
        user_id: existing.user_id ?? userId,
        pack_id: existing.pack_id,
        created_at: existing.created_at
      };
      list[index] = updated;
      return { record: updated, created: false };
    }
    list.push(record);
    return { record, created: true };
  }

  listForUser(userId) {
    return Array.isArray(this.byUser[userId]) ? [...this.byUser[userId]] : [];
  }

  /** All intents across donors (coordinator dashboard). */
  listAll({ userIdFilter = null } = {}) {
    const rows = [];
    for (const [userId, list] of Object.entries(this.byUser)) {
      if (!Array.isArray(list)) {
        continue;
      }
      if (userIdFilter && userId !== userIdFilter) {
        continue;
      }
      for (const record of list) {
        rows.push(record);
      }
    }
    return rows;
  }
}
