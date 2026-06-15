/** Human-readable order codes (e.g. SB-7K2M-9F3) for eco kitchen handoff. */

const CODE_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function pickChars(length) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    out += CODE_ALPHABET[idx];
  }
  return out;
}

export function generateOrderCode() {
  return `SB-${pickChars(4)}-${pickChars(3)}`;
}

export function isValidOrderCode(value) {
  return typeof value === "string" && /^SB-[0-9A-Z]{4}-[0-9A-Z]{3}$/.test(value);
}
