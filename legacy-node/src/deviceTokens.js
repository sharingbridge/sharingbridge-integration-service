function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateUpsertDeviceTokenRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }
  if (!isNonEmptyString(payload.fcm_token)) {
    return "fcm_token is required.";
  }
  const platform =
    typeof payload.platform === "string" ? payload.platform.trim() : "android";
  if (!platform) {
    return "platform must be a non-empty string.";
  }
  return null;
}

export function buildDeviceTokenRecord(payload, { userId }) {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    fcm_token: payload.fcm_token.trim(),
    platform:
      typeof payload.platform === "string" && payload.platform.trim()
        ? payload.platform.trim()
        : "android",
    updated_at: now
  };
}
