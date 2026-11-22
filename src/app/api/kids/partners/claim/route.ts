// POST /api/kids/partners/claim {token}: a business the owner added takes over its dashboard with
// the private invite link (same as FurFriend's /api/partners/claim). The token works once.

import { signedInUser, rest } from "@/lib/tagserver";
import { kidPartnerForUser } from "@/lib/kidpartners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ ok: false, error: "Sign in or make an account first." }, { status: 401 });
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  const token = typeof b.token === "string" ? b.token.trim() : "";
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return Response.json({ ok: false, error: "That invite link isn't complete. Open it again from the email." }, { status: 400 });
  try {
    const mine = await kidPartnerForUser(user.id);
    if (mine) {
      const open = await rest<{ name: string }[]>(`ks_partners?select=name&claim_token=eq.${token}&owner_id=is.null`);
      if (!open.length) return Response.json({ ok: true, already: true, name: mine.name });
      return Response.json({ ok: false, error: `This account already runs ${mine.name}'s dashboard. Sign out and use another account for ${open[0].name}.` }, { status: 409 });
    }
    const rows = await rest<{ id: string; name: string }[]>(
      `ks_partners?claim_token=eq.${token}&owner_id=is.null`,
      { method: "PATCH", body: JSON.stringify({ owner_id: user.id, claim_token: null, updated_at: new Date().toISOString() }), prefer: "return=representation" },
    );
    if (!rows.length) return Response.json({ ok: false, error: "This invite link has already been used or was replaced. Ask us for a new one." }, { status: 404 });
    return Response.json({ ok: true, name: rows[0].name });
  } catch (e) {
    console.error("[kids/partners] claim", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "Couldn't open your dashboard. Please try again." }, { status: 503 });
  }
}
