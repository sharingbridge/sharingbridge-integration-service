import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class PreferencesStore {
  constructor(dbPath) {
    if (!dbPath || typeof dbPath !== "string" || !dbPath.trim()) {
      throw new Error(
        "PreferencesStore requires an explicit dbPath (tests use a temp file)."
      );
    }
    this.dbPath = dbPath;
    this.state = { byUser: {} };
  }

  async init() {
    try {
      const content = await readFile(this.dbPath, "utf8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && parsed.byUser) {
        this.state = parsed;
      }
    } catch {
      // Start with empty store on first run or invalid content.
      await this.persist();
    }
  }

  getByUser(userId) {
    return this.state.byUser[userId] || [];
  }

  async saveForUser(userId, presets) {
    const existing = this.getByUser(userId);
    const dedupMap = new Map(existing.map((p) => [`${p.restaurant_name}|${p.order_url}`, p]));
    for (const preset of presets) {
      dedupMap.set(`${preset.restaurant_name}|${preset.order_url}`, preset);
    }
    this.state.byUser[userId] = [...dedupMap.values()];
    await this.persist();
    return this.state.byUser[userId];
  }

  async clearForUser(userId) {
    this.state.byUser[userId] = [];
    await this.persist();
    return [];
  }

  /**
   * Removes one preset matching trimmed (restaurant_name, order_url),
   * same key as saveForUser dedupe.
   */
  async removePresetForUser(userId, { restaurant_name, order_url }) {
    const key = (p) =>
      `${String(p.restaurant_name ?? "").trim()}|${String(p.order_url ?? "").trim()}`;
    const target = key({ restaurant_name, order_url });
    const existing = this.getByUser(userId);
    const next = existing.filter((p) => key(p) !== target);
    this.state.byUser[userId] = next;
    await this.persist();
    return next;
  }

  async persist() {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await writeFile(this.dbPath, JSON.stringify(this.state, null, 2), "utf8");
  }
}
