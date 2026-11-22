// Server-only email via Resend, from Kid Safe's own name on the ecosystem's verified sending
// subdomain (emails.unitedundergod.org). The API key never leaves the server.

type SendArgs = { to: string; subject: string; html: string; text: string; from?: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail({ to, subject, html, text, from: fromName }: SendArgs): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("email_not_configured");
  const from = fromName || KID_EMAIL_FROM;
  const replyTo = process.env.RESEND_REPLY_TO;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`resend_failed_${res.status}: ${detail.slice(0, 300)}`);
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Kid Safe: "Someone scanned Emma's tag". Sent to the parent's sign-in email. */
export const KID_EMAIL_FROM = "Kid Safe <no-reply@emails.unitedundergod.org>";

export function kidAlertEmail(args: {
  childName: string;
  kind: "scan" | "location" | "message";
  town: string | null;
  mapUrl: string | null;
  message: string | null;
  finderContact: string | null;
  accuracyM?: number | null;
  manageUrl: string;
  missing: boolean;
}): { subject: string; html: string; text: string } {
  const { childName, kind, town, mapUrl, message, finderContact, manageUrl, missing, accuracyM } = args;
  const where = town ? ` near ${town}` : "";
  const subject =
    kind === "location" ? `📍 Someone with ${childName} shared where they are`
    : kind === "message" ? `💬 A message about ${childName}`
    : `🚨 ${childName}'s Kid Safe tag was just scanned${where}`;
  const lines: string[] = [];
  if (kind === "scan") lines.push(`Someone just scanned ${childName}'s tag${where}. They may be with ${childName} right now, so keep your phone close for their call.`);
  if (kind === "location") {
    const near = accuracyM ? ` (within about ${Math.max(5, Math.round(accuracyM / 5) * 5)} m)` : "";
    lines.push(`The person who scanned ${childName}'s tag shared where they are${near}. Tap the map to go straight there.`);
  }
  if (kind === "message") lines.push(`The person who scanned ${childName}'s tag sent you a message${where}.`);
  if (message) lines.push(`"${message}"`);
  if (finderContact) lines.push(`How to reach them: ${finderContact}`);
  if (mapUrl) lines.push(`Map: ${mapUrl}`);
  if (kind === "scan" && !missing) lines.push(`If ${childName} is lost, open Kid Safe and tap "${childName} is missing" so the person helping sees it, and send staff the share page.`);
  const text = `${lines.join("\n\n")}\n\nOpen Kid Safe: ${manageUrl}\n\nYou get this because this tag is linked to your Kid Safe family.`;
  const html = `<!doctype html><html><head><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;background:#f3f6fb;font-family:Nunito,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2740">
  <div style="max-width:480px;margin:0 auto;padding:28px 20px">
    <div style="font-size:22px;font-weight:800;color:#1c2740">🛡️ Kid Safe</div>
    <div style="background:#fff;border:1px solid #dbe3f0;border-radius:14px;padding:22px;margin-top:16px">
      <h1 style="font-size:19px;margin:0 0 10px;color:#1c2740">${esc(subject)}</h1>
      ${lines.map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px;color:#1c2740">${esc(l)}</p>`).join("")}
      ${mapUrl ? `<a href="${esc(mapUrl)}" style="display:inline-block;background:#12735a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;font-size:15px;margin:4px 8px 4px 0">Open the map</a>` : ""}
      <a href="${esc(manageUrl)}" style="display:inline-block;background:#1f4fa8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;font-size:15px;margin:4px 0">Open Kid Safe</a>
    </div>
    <p style="font-size:12px;line-height:1.5;color:#55617a;margin:16px 4px 0">You get this because this tag is linked to your Kid Safe family. A United Under God app.</p>
  </div></body></html>`;
  return { subject, html, text };
}

/** Kid Safe's own password reset email (never FurFriend's): same shared account, Kid Safe's name and look. */
export function kidPasswordResetEmail(link: string): { subject: string; html: string; text: string } {
  const subject = "Reset your Kid Safe password";
  const text =
    `Reset your Kid Safe password by opening this link:\n\n${link}\n\n` +
    `This link works once and expires in about an hour. If you didn't ask to reset your password, ` +
    `you can ignore this email and nothing will change.\n\nIf your child is missing right now, tell the nearest staff member or security, or call 911.`;
  const html = `<!doctype html><html><head><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;background:#f3f6fb;font-family:Nunito,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2740">
  <div style="max-width:480px;margin:0 auto;padding:28px 20px">
    <div style="font-size:22px;font-weight:800;color:#1c2740">🛡️ Kid Safe</div>
    <div style="background:#fff;border:1px solid #dbe3f0;border-radius:14px;padding:22px;margin-top:16px">
      <h1 style="font-size:19px;margin:0 0 8px;color:#1c2740">Reset your password</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 18px;color:#4a5672">Tap the button to choose a new password. This link works once and expires in about an hour.</p>
      <a href="${esc(link)}" style="display:inline-block;background:#1f4fa8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;font-size:15px">Choose a new password</a>
      <p style="font-size:13px;line-height:1.5;margin:18px 0 0;color:#4a5672">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all;color:#1f4fa8">${esc(link)}</span></p>
    </div>
    <p style="font-size:13px;line-height:1.5;color:#1c2740;margin:16px 4px 0"><b>If your child is missing right now,</b> tell the nearest staff member or security, or call 911. You don't need to sign in for staff to reach you: the number on your child's tag works.</p>
    <p style="font-size:12px;line-height:1.5;color:#55617a;margin:12px 4px 0">If you didn't ask to reset your password, you can ignore this email. A United Under God app.</p>
  </div></body></html>`;
  return { subject, html, text };
}

/* ------------------------------ Kid Safe partners ------------------------------ */

function kidFrame(title: string, paras: string[], button?: { href: string; label: string }): string {
  return `<!doctype html><html><head><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;background:#f3f6fb;font-family:Nunito,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2740">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <div style="font-size:22px;font-weight:800;color:#1c2740">🛡️ Kid Safe</div>
    <div style="background:#fff;border:1px solid #dbe3f0;border-radius:14px;padding:22px;margin-top:16px">
      <h1 style="font-size:19px;margin:0 0 10px;color:#1c2740">${esc(title)}</h1>
      ${paras.map((p) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px;color:#1c2740">${esc(p)}</p>`).join("")}
      ${button ? `<a href="${esc(button.href)}" style="display:inline-block;background:#1f4fa8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;font-size:15px;margin:4px 0">${esc(button.label)}</a>` : ""}
    </div>
    <p style="font-size:12px;line-height:1.5;color:#55617a;margin:16px 4px 0">Kid Safe partners. A United Under God app.</p>
  </div></body></html>`;
}

export function kidPartnerAppliedEmail(args: { name: string }) {
  const subject = "We got your Kid Safe partner application";
  const paras = [`Thank you for applying for ${args.name}. We'll look it over and email you, usually within a day or two.`,
    "Once you're approved, your dashboard has your own link, a printable counter display, and what families did with it."];
  return { subject, html: kidFrame(subject, paras), text: paras.join("\n\n") };
}

export function kidPartnerAdminEmail(args: { headline: string; name: string; kind: string; contact: string; detail?: string; deskUrl: string }) {
  const subject = `Kid Safe partner: ${args.headline} (${args.name})`;
  const what = args.headline.charAt(0).toUpperCase() + args.headline.slice(1);
  const paras = [`${what}: ${args.name} (${args.kind}).`, `Contact: ${args.contact || "none given"}`, ...(args.detail ? [args.detail] : [])];
  return { subject, html: kidFrame(subject, paras, { href: args.deskUrl, label: "Open the Kid Safe partner desk" }), text: `${paras.join("\n\n")}\n\n${args.deskUrl}` };
}

export function kidPartnerApprovedEmail(args: { name: string; link: string; dashboardUrl: string }) {
  const subject = `${args.name} is a Kid Safe partner`;
  const paras = [
    `Welcome! Families who scan your display or open your link (${args.link}) can set up their children in a couple of minutes, free.`,
    "Your dashboard has a printable counter display with your QR code, and shows how many families joined through you and how many of your blank tags they've registered.",
  ];
  return { subject, html: kidFrame(subject, paras, { href: args.dashboardUrl, label: "Open your dashboard" }), text: `${paras.join("\n\n")}\n\n${args.dashboardUrl}` };
}

export function kidPartnerInviteEmail(args: { name: string; inviteUrl: string }) {
  const subject = `Your Kid Safe partner dashboard for ${args.name}`;
  const paras = [
    `We've set up ${args.name} as a Kid Safe partner. Open this private link to make your account and take over your dashboard: your QR link, your printable display, and what families did with it.`,
    "The link works once. If someone else should run the dashboard, forward it to them before opening it.",
  ];
  return { subject, html: kidFrame(subject, paras, { href: args.inviteUrl, label: "Open my dashboard" }), text: `${paras.join("\n\n")}\n\n${args.inviteUrl}` };
}
