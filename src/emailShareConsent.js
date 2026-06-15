export function validateEmailShareConsent(payload) {
  if (payload?.email_share_consent === true) {
    return null;
  }
  return "email_share_consent must be true — login email may be shared with the eco kitchen for off-platform coordination.";
}

export function emailShareConsentTimestamp(payload) {
  if (payload?.email_share_consent === true) {
    return new Date().toISOString();
  }
  return null;
}
