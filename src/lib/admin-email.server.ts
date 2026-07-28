// Server-side email helper for admin alerts. Uses Resend via the Lovable connector gateway.
// Silently no-ops (with a console warning) if RESEND_API_KEY isn't linked yet.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export async function sendAdminEmail(opts: {
  subject: string;
  html: string;
  to?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const to = opts.to ?? process.env.ADMIN_ALERT_EMAIL;
  if (!to) return { ok: false, error: "ADMIN_ALERT_EMAIL not set" };
  if (!apiKey || !resendKey) {
    console.warn("[admin-email] Resend not connected — skipping send to", to);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        // Mailbox providers block sending "from" a gmail.com address, so the
        // envelope sender stays on a verified domain while replies land in the
        // Sparkling Silver inbox.
        from: process.env.SENDER_EMAIL ?? "Sparkling Silver <onboarding@resend.dev>",
        to: [to],
        reply_to: process.env.REPLY_TO_EMAIL ?? "arikafactory@gmail.com",
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[admin-email] send failed", res.status, text);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[admin-email] send error", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export function lowStockAlertHtml(item: { name: string; sku: string; qty: number; threshold: number }) {
  const status = item.qty === 0 ? "OUT OF STOCK" : "LOW STOCK";
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
      <h2 style="color:#6D1F2E;margin:0 0 8px">${status}</h2>
      <p style="margin:0 0 16px;color:#444">A product just crossed its low-stock threshold.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#666">Product</td><td style="padding:6px 0"><b>${escapeHtml(item.name)}</b></td></tr>
        <tr><td style="padding:6px 0;color:#666">SKU</td><td style="padding:6px 0">${escapeHtml(item.sku)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Current qty</td><td style="padding:6px 0"><b>${item.qty}</b></td></tr>
        <tr><td style="padding:6px 0;color:#666">Threshold</td><td style="padding:6px 0">${item.threshold}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#999">Sparkling Silver — automated inventory alert</p>
    </div>`;
}

export function digestHtml(items: Array<{ name: string; sku: string; qty: number; threshold: number }>) {
  const rows = items
    .map(
      (i) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#666">${escapeHtml(i.sku)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right"><b style="color:${i.qty === 0 ? "#b91c1c" : "#92400e"}">${i.qty}</b></td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#666">${i.threshold}</td>
    </tr>`,
    )
    .join("");
  return `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto;padding:24px">
      <h2 style="color:#6D1F2E">Daily inventory digest</h2>
      <p style="color:#444">${items.length} product${items.length === 1 ? "" : "s"} at or below threshold.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:12px">
        <thead><tr style="background:#fafafa">
          <th style="padding:8px;text-align:left">Product</th>
          <th style="padding:8px;text-align:left">SKU</th>
          <th style="padding:8px;text-align:right">Qty</th>
          <th style="padding:8px;text-align:right">Threshold</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
