function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateCreateOrderIntentRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }
  if (!isNonEmptyString(payload.pack_id) && !isNonEmptyString(payload.instruction_pack_id)) {
    return "pack_id (or instruction_pack_id) is required.";
  }
  if (
    payload.status != null &&
    payload.status !== "instructions_copied" &&
    payload.status !== "created"
  ) {
    return "status must be instructions_copied or created.";
  }
  if (payload.presets_snapshot != null && !Array.isArray(payload.presets_snapshot)) {
    return "presets_snapshot must be an array when provided.";
  }
  return null;
}

export function resolvePackId(payload) {
  return (
    (typeof payload.pack_id === "string" && payload.pack_id.trim()) ||
    (typeof payload.instruction_pack_id === "string" &&
      payload.instruction_pack_id.trim()) ||
    ""
  );
}

export function buildOrderIntentRecord(payload, { userId }) {
  const now = new Date().toISOString();
  const packId = resolvePackId(payload) || `pack-unknown-${Date.now()}`;

  return {
    id: `oi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    pack_id: packId,
    status: payload.status || "instructions_copied",
    has_reference_photo: Boolean(payload.has_reference_photo),
    verbal_handover_notes:
      typeof payload.verbal_handover_notes === "string"
        ? payload.verbal_handover_notes.trim()
        : "",
    presets_snapshot: Array.isArray(payload.presets_snapshot)
      ? payload.presets_snapshot
      : [],
    selected_preset:
      payload.selected_preset && typeof payload.selected_preset === "object"
        ? payload.selected_preset
        : null,
    created_at: now,
    updated_at: now
  };
}

export function formatOrderIntentForApi(record) {
  return {
    order_intent_id: record.id,
    user_id: record.user_id ?? null,
    pack_id: record.pack_id,
    status: record.status,
    has_reference_photo: Boolean(record.has_reference_photo),
    verbal_handover_notes: record.verbal_handover_notes ?? "",
    presets_snapshot: Array.isArray(record.presets_snapshot)
      ? record.presets_snapshot
      : [],
    selected_preset:
      record.selected_preset && typeof record.selected_preset === "object"
        ? record.selected_preset
        : null,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export function sortOrderIntentsNewestFirst(records) {
  return [...records].sort((left, right) => {
    const rightTime = Date.parse(right.updated_at || right.created_at || 0);
    const leftTime = Date.parse(left.updated_at || left.created_at || 0);
    return rightTime - leftTime;
  });
}

export function mergeOrderIntentRecord(existing, payload) {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: payload.status || existing.status || "instructions_copied",
    has_reference_photo:
      payload.has_reference_photo != null
        ? Boolean(payload.has_reference_photo)
        : existing.has_reference_photo,
    verbal_handover_notes:
      typeof payload.verbal_handover_notes === "string"
        ? payload.verbal_handover_notes.trim()
        : existing.verbal_handover_notes,
    presets_snapshot: Array.isArray(payload.presets_snapshot)
      ? payload.presets_snapshot
      : existing.presets_snapshot,
    selected_preset:
      payload.selected_preset && typeof payload.selected_preset === "object"
        ? payload.selected_preset
        : existing.selected_preset,
    updated_at: now
  };
}
