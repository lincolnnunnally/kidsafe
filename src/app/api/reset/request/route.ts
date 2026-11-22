// Self-serve password reset on shared LPL GoTrue (which has no mailer).
// We generate a recovery link with the service role and send it ourselves.
// Unknown emails still get { ok: true } so this is not an account oracle.
// Mailer / GoTrue failure is 503 — never "we sent it" when we didn't.

import { clientIp, hashKey, rateLimit } from "@/lib/ratelimit";
import { emailConfigured, kidPasswordResetEmail, sendEmail } from "@/lib/email";
import { KID_TAG_BASE } from "@/lib/kidsafe-shared";

export const runtime = "nodejs";

const UNAVAILABLE = {
  error: "reset_unavailable",
  message:
    "We couldn't send a reset email right now. Please try again in a few minutes.",
};

const ok = () => Response.json({ ok: true });

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !emailConfigured()) {
    return Response.json(UNAVAILABLE, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return ok();
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email.includes("@") || email.length < 5 || email.length > 320) return ok();

  const ip = clientIp(request);
  const limited = rateLimit(`ks-reset:${hashKey(ip)}`, 8, 10 * 60 * 1000);
  if (!limited.ok) {
    return Response.json(
      { error: "That's a lot of tries. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  // Kid Safe's own reset page, address and sender. Accounts are the ecosystem's shared ones.
  const kidOrigin = (process.env.KIDSAFE_ORIGIN || KID_TAG_BASE).replace(/\/+$/, "");
  const redirectTo = `${kidOrigin}/reset`;

  type LinkPayload = {
    action_link?: string;
    hashed_token?: string;
    properties?: { action_link?: string; hashed_token?: string };
  };
  let payload: LinkPayload | null = null;
  try {
    const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "recovery", email, redirect_to: redirectTo }),
    });
    if (res.status === 404) return ok();
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[reset] generate_link failed", res.status, detail.slice(0, 300));
      return Response.json(UNAVAILABLE, { status: 503 });
    }
    payload = (await res.json()) as LinkPayload;
  } catch (e) {
    console.error("[reset] generate_link error", e instanceof Error ? e.message : e);
    return Response.json(UNAVAILABLE, { status: 503 });
  }

  // The link goes straight to Kid Safe's reset page with the one-time token, so it never depends on
  // the auth server's list of allowed return addresses (which would fall back to another app).
  const hashed = payload?.hashed_token || payload?.properties?.hashed_token;
  if (!hashed) return ok();
  const link = `${kidOrigin}/reset?token_hash=${encodeURIComponent(hashed)}&type=recovery`;

  try {
    const mail = kidPasswordResetEmail(link);
    await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (e) {
    console.error("[reset] email send failed", e instanceof Error ? e.message : e);
    return Response.json(UNAVAILABLE, { status: 503 });
  }

  return ok();
}
