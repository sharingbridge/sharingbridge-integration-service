/**
 * One-shot migration: integration-service PreferencesStore (`data/preferences.json`)
 * → sharingbridge-user-service donor-presets (PUT per user).
 *
 * Prerequisites:
 *   - user-service reachable (mint + PUT)
 *   - Same AUTH_TOKEN_SECRET as user-service (script signs JWTs locally)
 *
 * Environment:
 *   USER_SERVICE_BASE_URL   default http://127.0.0.1:8081
 *   PREFERENCES_DB_PATH     path to preferences.json (same as PreferencesStore)
 *                           default ./data/preferences.json
 *   BACKFILL_DRY_RUN       if "1"/"true", log only — no PUTs
 */

import { readFile } from "node:fs/promises";
import { mintAuthToken } from "../src/tokenService.js";

function readEnvBool(name) {
  const v = process.env[name];
  return v === "1" || v?.toLowerCase() === "true";
}

/**
 * Normalize a preset row from PreferencesStore JSON into user-service PUT shape.
 */
export function normalizePresetForUserService(preset) {
  if (!preset || typeof preset !== "object") return null;

  const restaurantName =
    preset.restaurant_name != null ? String(preset.restaurant_name).trim() : "";
  const orderUrl =
    preset.order_url != null ? String(preset.order_url).trim() : "";
  const rawMenu = preset.menu_items;
  const menuItems = Array.isArray(rawMenu)
    ? rawMenu.map((x) => String(x)).filter((x) => x.trim().length > 0)
    : [];
  const appName =
    preset.app_name != null ? String(preset.app_name).trim() : "";

  let confidence = preset.confidence;
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    const n = Number(confidence);
    confidence = typeof n === "number" && !Number.isNaN(n) ? n : 0;
  }

  const source =
    typeof preset.source === "string" && preset.source.trim()
      ? preset.source.trim()
      : "migrated_from_integration_store";

  if (!restaurantName || !orderUrl || menuItems.length === 0 || !appName) {
    return null;
  }

  return {
    ...(preset.id ? { id: String(preset.id) } : {}),
    ...(preset.saved_at ? { saved_at: String(preset.saved_at) } : {}),
    restaurant_name: restaurantName,
    order_url: orderUrl,
    menu_items: menuItems,
    app_name: appName,
    source,
    confidence
  };
}

function mintToken(_baseUrl, userId) {
  return mintAuthToken(userId, { role: "donor" });
}

async function putPresets(baseUrl, userId, presets, bearerToken, dryRun) {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/users/${encodeURIComponent(userId)}/donor-presets`;
  if (dryRun) {
    console.log(`[dry-run] PUT ${url} presets=${presets.length}`);
    return;
  }
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bearerToken}`
    },
    body: JSON.stringify({ presets })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT failed for ${userId}: HTTP ${res.status} ${text}`);
  }
}

export async function backfillPrefsToUserService({
  userServiceBaseUrl = process.env.USER_SERVICE_BASE_URL || "http://127.0.0.1:8081",
  preferencesDbPath =
    process.env.PREFERENCES_DB_PATH ||
    "./data/preferences.json",
  dryRun = readEnvBool("BACKFILL_DRY_RUN")
} = {}) {
  const raw = await readFile(preferencesDbPath, "utf8");
  const parsed = JSON.parse(raw);
  const byUser = parsed?.byUser;
  if (!byUser || typeof byUser !== "object") {
    throw new Error("Invalid preferences file: missing byUser.");
  }

  const userIds = Object.keys(byUser);
  console.log(`Backfill ${userIds.length} user(s) → ${userServiceBaseUrl}${dryRun ? " (dry-run)" : ""}`);

  for (const userId of userIds) {
    const rows = Array.isArray(byUser[userId]) ? byUser[userId] : [];
    const normalized = [];
    for (const row of rows) {
      const n = normalizePresetForUserService(row);
      if (n) normalized.push(n);
    }

    if (normalized.length === 0) {
      console.log(`  skip ${userId}: no valid presets`);
      continue;
    }

    const token = await mintToken(userServiceBaseUrl, userId);
    await putPresets(userServiceBaseUrl, userId, normalized, token, dryRun);
    console.log(`  ok ${userId}: ${normalized.length} preset(s)`);
  }

  console.log("Backfill finished.");
}

import { pathToFileURL } from "node:url";

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  backfillPrefsToUserService().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
