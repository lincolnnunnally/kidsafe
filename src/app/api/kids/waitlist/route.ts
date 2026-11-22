// POST { email } -> join the Kid Safe engraved-tag waitlist. Same answer whether the address was
// new or already on the list, so it can't be used to look people up.

import { clientIp, hashKey, rateLimit } from "@/lib/ratelimit";
import { rest, serviceReady } from "@/lib/tagserver";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  if (typeof body.website === "string" && body.website.trim()) return Response.json({ ok: true });
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return Response.json({ ok: false, error: "Please enter a real email address." }, { status: 400 });
  }
  const limited = rateLimit(`ks-waitlist:${hashKey(clientIp(request))}`, 10, 10 * 60 * 1000);
  if (!limited.ok) return Response.json({ ok: false, error: "That's a lot of tries. Please wait a minute." }, { status: 429 });
  if (!serviceReady()) return Response.json({ ok: false, error: "Please try again in a minute." }, { status: 503 });
  try {
    await rest("ks_waitlist?on_conflict=email", {
      method: "POST",
      body: JSON.stringify({ email }),
      prefer: "resolution=ignore-duplicates,return=minimal",
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[kids/waitlist]", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "Please try again in a minute." }, { status: 503 });
  }
}
