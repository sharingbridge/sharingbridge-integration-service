function sanitizeHandoverNotes(text) {
  return (text || "").trim().replace(/\s+/g, " ");
}

/**
 * Local fallback when AI orchestration is disabled or unreachable.
 * Courier-facing text only (no donor UI or preset list).
 */
export function buildInstructionPackFallback(payload) {
  const verbal = sanitizeHandoverNotes(payload?.verbal_handover_notes);
  const hasPhoto = Boolean(payload?.has_reference_photo);

  const lines = [
    "This meal was arranged through SharingBridge for handover to the recipient.",
    ""
  ];

  if (hasPhoto) {
    lines.push("Reference photo: available to delivery partner per app policy.", "");
  }

  if (verbal) {
    lines.push(`Handover notes: ${verbal}`, "");
  }

  lines.push(
    "Additional details:",
    "",
    "",
    "Please deliver to the location provided in the vendor app.",
    "Identify the recipient using the handover notes and reference photo only with their consent.",
    "Hand over the package and confirm delivery in the vendor app."
  );

  return {
    pack_id: `fallback-${Date.now()}`,
    delivery_instructions: lines.join("\n"),
    generated_at: new Date().toISOString(),
    source: "fallback"
  };
}
