import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PreferencesStore } from "../../src/preferencesStore.js";
import { LocalPreferencesRepository } from "../../src/preferencesRepository.js";
import { OrderIntentStore } from "../../src/orderIntentStore.js";

/** Temp file-backed stores for route tests (never under repo `data/`). */
export async function createTempIntegrationStores(prefix = "sb-int-") {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const preferencesStore = new PreferencesStore(
    path.join(dir, "preferences.json")
  );
  const preferencesRepository = new LocalPreferencesRepository(
    preferencesStore
  );
  await preferencesRepository.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: dir });
  await orderIntentStore.init();
  return {
    dir,
    preferencesRepository,
    orderIntentStore,
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    }
  };
}

/** Order intents only — prefs tests that use UserServicePreferencesRepository. */
export async function createTempOrderIntentStore(prefix = "sb-oi-") {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const orderIntentStore = new OrderIntentStore({ dataDir: dir });
  await orderIntentStore.init();
  return {
    dir,
    orderIntentStore,
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
