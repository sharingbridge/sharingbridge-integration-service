import { logAt } from "./serviceLog.js";

export function buildConnectionReadyEmail(orderCode) {
  const code = String(orderCode ?? "").trim();
  const subject = `SharingBridge — order ${code} connection ready`;
  const text =
    `Order ${code} — a connection is ready. Open SharingBridge and go to Actions → this order.\n\n` +
    "We do not send payment links or QR codes by email. Confirm the order code in the app before paying anyone.";
  return { subject, text };
}

/**
 * Notification-only email handoff. When CONNECTION_NOTIFY_WEBHOOK_URL is set,
 * POSTs a JSON payload for notification-service (or any mailer) to deliver.
 * Otherwise logs at info level — no recipient emails in logs.
 */
export async function notifyConnectionReady({
  orderCode,
  recipientUserIds = [],
  lookupEmails,
  fetchImpl = globalThis.fetch
}) {
  const trimmed = String(orderCode ?? "").trim();
  if (!trimmed) {
    return { sent: false, reason: "missing_order_code" };
  }

  const webhook = process.env.CONNECTION_NOTIFY_WEBHOOK_URL?.trim();
  const emailByUserId = lookupEmails
    ? await lookupEmails(recipientUserIds)
    : {};
  const recipientEmails = [
    ...new Set(
      recipientUserIds
        .map((id) => emailByUserId[id])
        .filter((email) => typeof email === "string" && email.trim())
    )
  ];

  const { subject, text } = buildConnectionReadyEmail(trimmed);
  const payload = {
    type: "connection_ready",
    order_code: trimmed,
    recipient_emails: recipientEmails,
    subject,
    text
  };

  if (!webhook) {
    logAt(
      "info",
      `[connection-notify] order ${trimmed} ready — ${recipientEmails.length} recipient(s); set CONNECTION_NOTIFY_WEBHOOK_URL to deliver email`
    );
    return { sent: false, reason: "webhook_not_configured", recipient_count: recipientEmails.length };
  }

  const response = await fetchImpl(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    logAt(
      "warn",
      `[connection-notify] webhook HTTP ${response.status} for order ${trimmed}`
    );
    return { sent: false, reason: "webhook_failed", status: response.status };
  }

  return { sent: true, recipient_count: recipientEmails.length };
}
