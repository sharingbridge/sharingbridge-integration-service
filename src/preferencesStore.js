import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_DB_PATH = process.env.PREFERENCES_DB_PATH || "./data/preferences.json";

export class PreferencesStore {
  constructor(dbPath = DEFAULT_DB_PATH) {
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

  async persist() {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await writeFile(this.dbPath, JSON.stringify(this.state, null, 2), "utf8");
  }
}
