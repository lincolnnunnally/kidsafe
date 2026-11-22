// POST /api/kids/partners/credit: after a parent saves their family, credit the partner whose
// display, link or blank tag brought them (the ks_partner cookie, or the tag's batch), once.
// Attribution only; no money moves.

import { signedInUser, rest, normalizeTagCode } from "@/lib/tagserver";
import { approvedKidPartner, partnerSlugFromCookie } from "@/lib/kidpartners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ ok: false }, { status: 401 });
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  try {
    let partnerId: string | null = null;
    const code = normalizeTagCode(b.code);
    if (code) {
      const rows = await rest<{ ks_tag_batches: { partner_id: string | null; ks_partners: { status: string } | null } | null }[]>(
        `ks_tags?select=ks_tag_batches(partner_id,ks_partners(status))&code=eq.${code}&owner_id=eq.${user.id}`,
      );
      const bt = rows[0]?.ks_tag_batches;
      if (bt?.partner_id && bt.ks_partners?.status === "approved") partnerId = bt.partner_id;
    }
    if (!partnerId) {
      const slug = partnerSlugFromCookie(request);
      const p = slug ? await approvedKidPartner(slug) : null;
      partnerId = p?.id || null;
    }
    if (!partnerId) return Response.json({ ok: true, credited: false });
    const rows = await rest<{ owner_id: string }[]>(`ks_families?owner_id=eq.${user.id}&partner_id=is.null`, {
      method: "PATCH", body: JSON.stringify({ partner_id: partnerId }), prefer: "return=representation",
    });
    return Response.json({ ok: true, credited: rows.length > 0 });
  } catch (e) {
    console.error("[kids/partners] credit", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
