function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPresetItem(item) {
  return (
    item &&
    typeof item === "object" &&
    isNonEmptyString(item.restaurant_name) &&
    Array.isArray(item.menu_items) &&
    isNonEmptyString(item.app_name)
  );
}

export function validateInstructionPackRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }

  if (payload.presets != null) {
    if (!Array.isArray(payload.presets)) {
      return "presets must be an array when provided.";
    }
    for (const item of payload.presets) {
      if (!isPresetItem(item)) {
        return "Each preset must include restaurant_name, menu_items, and app_name.";
      }
    }
  }

  if (
    payload.verbal_handover_notes != null &&
    typeof payload.verbal_handover_notes !== "string"
  ) {
    return "verbal_handover_notes must be a string when provided.";
  }

  if (
    payload.has_reference_photo != null &&
    typeof payload.has_reference_photo !== "boolean"
  ) {
    return "has_reference_photo must be a boolean when provided.";
  }

  return null;
}

export function mapInstructionPackRequest(payload, { userId } = {}) {
  return {
    user_id: userId,
    verbal_handover_notes: payload.verbal_handover_notes ?? "",
    has_reference_photo: Boolean(payload.has_reference_photo),
    reference_photo_artifact_id: payload.reference_photo_artifact_id ?? null,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    location_label: payload.location_label ?? null,
    presets: Array.isArray(payload.presets) ? payload.presets : [],
    donor_display_name: payload.donor_display_name ?? null,
    seeker_display_name: payload.seeker_display_name ?? null
  };
}

export async function resolveInstructionPackResponse(
  payload,
  { aiClient, userId }
) {
  const { isInstructionPackAiEnabled } = await import("./aiOrchestrationClient.js");
  if (isInstructionPackAiEnabled() && aiClient?.isConfigured()) {
    try {
      const upstream = await aiClient.instructionPack(
        mapInstructionPackRequest(payload, { userId })
      );
      return {
        pack_id: upstream.pack_id,
        delivery_instructions: upstream.delivery_instructions,
        generated_at: upstream.generated_at,
        source: upstream.source || "orchestration"
      };
    } catch {
      const { buildInstructionPackFallback } = await import(
        "./instructionPackFallback.js"
      );
      return { ...buildInstructionPackFallback(payload), source: "fallback_error" };
    }
  }

  const { buildInstructionPackFallback } = await import(
    "./instructionPackFallback.js"
  );
  return buildInstructionPackFallback(payload);
}
