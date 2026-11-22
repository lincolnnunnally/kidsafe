// Kid Safe account signup on the shared ecosystem GoTrue (the same route as the other ecosystem apps).
//
// Why a server route: LPL GoTrue requires email confirmation and has no mailer,
// so a public browser signup would leave users unconfirmed and the password grant
// would fail "Email not confirmed". The proven ecosystem pattern is a server-side
// POST /auth/v1/admin/users with email_confirm:true using the service-role key.
// The key never leaves this route; everything else runs in the browser on the
// anon key under RLS.
//
// Shared-GoTrue rule: "email already registered" is NORMAL — a sibling app
// already has this person. We adopt the identity: the client signs in with the
// password they typed, and we never reset a shared password.
//
// NO EXISTENCE ORACLE: this route used to answer { exists: true } vs
// { created: true }, which made it a free account-enumeration lookup for the
// whole ecosystem (Kindred, Aligned Souls, KND, ChurchConnect all share this auth
// pool). Both outcomes now return the same body and the same status, so the
// caller learns nothing. The sign-in that follows can still tell the difference —
// but only for someone who already has the right password, which is the normal
// property of any login form.
//
// RATE LIMITED: creating an account here writes a force-confirmed row on shared
// auth, so an unthrottled caller could bulk-create accounts, or pre-squat a real
// person's address with a password of their own choosing before they ever join.
// The limiter raises the cost a lot; see src/lib/ratelimit.ts for what in-memory
// counters can and can't promise on serverless.

import { clientIp, hashKey, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINUTE = 60 * 1000;

// The one answer for both "we made you an account" and "you already had one".
function ok() {
  return Response.json({ ok: true });
}

function slowDown(retryAfterSec: number) {
  return Response.json(
    { error: "That's a lot of tries in a short while. Please wait a minute and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: "Sign-up isn't connected right now. Please try again shortly." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "That request didn't look right." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const honeypot = String(body.hp || "");
  const ack = body.ack === true;

  // Honeypot: bots that fill every field are turned away before any account exists.
  if (honeypot !== "") return Response.json({ error: "That request didn't look right." }, { status: 400 });
  // Age + terms acknowledgment is required to create an account (also enforced in the UI).
  if (!ack) {
    return Response.json({ error: "Please confirm you're 18 or older and the parent or guardian of the children you add." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length < 6 || email.length > 320) {
    return Response.json({ error: "Please use a real email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return Response.json({ error: "Please choose a password of at least 8 characters." }, { status: 400 });
  }

  // Throttle only well-formed attempts, so a typo never counts against someone.
  // Per IP for volume, plus a stricter per-address bucket so one real person's
  // email can't be hammered (or probed) from a rotating pool of addresses.
  const ip = clientIp(request);
  const burst = rateLimit(`signup:ip:${ip}`, 5, 10 * MINUTE);
  if (!burst.ok) return slowDown(burst.retryAfterSec);
  const daily = rateLimit(`signup:ip-day:${ip}`, 20, 24 * 60 * MINUTE);
  if (!daily.ok) return slowDown(daily.retryAfterSec);
  const perEmail = rateLimit(`signup:email:${hashKey(email)}`, 3, 60 * MINUTE);
  if (!perEmail.ok) return slowDown(perEmail.retryAfterSec);

  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  if (response.ok) return ok();

  const detail = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const message = String(detail.msg || detail.error_description || detail.message || "");
  // Already registered somewhere in the ecosystem: same answer as a fresh create.
  // (Both paths make exactly one upstream call. GoTrue only hashes a password when
  // it really creates the user, so a determined attacker could still time the
  // difference — a far narrower signal than the flag we used to hand out, and one
  // that costs a request against the limits above every time.)
  if (/already|exists|registered/i.test(message)) return ok();
  if (/invalid.*email|email.*invalid|is invalid/i.test(message)) {
    return Response.json({ error: "Please use a real email address." }, { status: 400 });
  }
  return Response.json({ error: "Something went wrong creating your account. Please try again." }, { status: 400 });
}
