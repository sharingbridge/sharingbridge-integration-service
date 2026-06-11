/**
 * Read a config env var with a legacy fallback name (donor → initiator migration).
 * @param {string} primary
 * @param {string} legacy
 * @returns {string | undefined}
 */
export function readEnvWithLegacy(primary, legacy) {
  const primaryRaw = process.env[primary];
  if (typeof primaryRaw === "string" && primaryRaw.trim()) {
    return primaryRaw.trim();
  }
  const legacyRaw = process.env[legacy];
  if (typeof legacyRaw === "string" && legacyRaw.trim()) {
    return legacyRaw.trim();
  }
  return undefined;
}
