/**
 * Local fallback when AI orchestration is disabled or unreachable.
 * Mirrors mobile stub tone until orchestration is always on in prod.
 */
export function buildInstructionPackFallback(payload) {
  const presets = Array.isArray(payload?.presets) ? payload.presets : [];
  const verbal = (payload?.verbal_handover_notes || "").trim();
  const hasPhoto = Boolean(payload?.has_reference_photo);

  const lines = [
    "SharingBridge — delivery notes (integration fallback)",
    "",
    "Be careful with personal details: only include what a courier truly needs.",
    ""
  ];

  if (hasPhoto) {
    lines.push(
      "Reference: a photo was noted for this request. Connect photo-service for a secure URL.",
      ""
    );
  }

  if (verbal) {
    lines.push("Handover notes you entered:", verbal, "");
  }

  lines.push("Your saved order shortcuts:");
  if (presets.length === 0) {
    lines.push("(No presets supplied.)");
  } else {
    for (const p of presets) {
      const items =
        Array.isArray(p.menu_items) && p.menu_items.length
          ? p.menu_items.join(", ")
          : "(menu not listed)";
      lines.push(`- ${p.restaurant_name} (${p.app_name}): ${items}`);
    }
  }

  return {
    pack_id: `fallback-${Date.now()}`,
    delivery_instructions: lines.join("\n"),
    generated_at: new Date().toISOString(),
    source: "fallback"
  };
}
