// Kid Safe admin desk (admins are ff_admin_users, same as FurFriend's desk).
// GET                       → partners (applications first) with their numbers, displays, blank-tag batches
// GET ?batch=ID             → the codes in one batch (for printing)
// POST {action, ...}:
//   approve {id}            → link + approval email
//   pause|resume|decline {id}
//   note {id, note}
//   create {name, kind, email, contactName, phone, address} → an approved partner with an invite link
//   invite {id, fresh?}     → email the invite link (fresh: a new link, the old one stops working)
//   boardSent {id}
//   mint {quantity, label, partnerId?} → a batch of blank tags
//   board {note?, partnerId?} → a new counter display code

import { requireAdmin, rest, cleanText } from "@/lib/tagserver";
import {
  KID_DASHBOARD_URL, KID_KINDS, KID_PARTNER_COLS, kidBoardLink, kidPartnerInviteUrl, kidPartnerLink, kidPartnerStats, loadKidPartner,
  mintKidBatch, newKidBoardCode, newKidClaimToken, uniqueKidSlug, type KidPartnerRow,
} from "@/lib/kidpartners";
import { emailConfigured, KID_EMAIL_FROM, kidPartnerApprovedEmail, kidPartnerInviteEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORBIDDEN = { ok: false, error: "This is for Kid Safe admins." };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return Response.json(FORBIDDEN, { status: 401 });
  const batchId = new URL(request.url).searchParams.get("batch");
  try {
    if (batchId) {
      if (!/^[0-9a-f-]{36}$/i.test(batchId)) return Response.json({ ok: false, error: "Unknown batch." }, { status: 400 });
      const [batch] = await rest<{ id: string; label: string; quantity: number; ks_partners: { name: string } | null }[]>(
        `ks_tag_batches?select=id,label,quantity,ks_partners(name)&id=eq.${batchId}`,
      );
      if (!batch) return Response.json({ ok: false, error: "Unknown batch." }, { status: 404 });
      const tags = await rest<{ code: string; owner_id: string | null }[]>(`ks_tags?select=code,owner_id&batch_id=eq.${batchId}&order=code&limit=1000`);
      return Response.json({ ok: true, batch: { id: batch.id, label: batch.label, partner: batch.ks_partners?.name || null }, codes: tags.map((t) => ({ code: t.code, registered: !!t.owner_id })) });
    }
    const rows = await rest<(KidPartnerRow & { claim_token: string | null })[]>(`ks_partners?select=${KID_PARTNER_COLS},claim_token&order=created_at.desc&limit=200`);
    const order = { applied: 0, approved: 1, paused: 2, declined: 3 } as const;
    rows.sort((a, b) => order[a.status] - order[b.status]);
    const stats = await Promise.all(rows.map((r) => (r.status === "approved" || r.status === "paused" ? kidPartnerStats(r) : null)));
    const boards = await rest<{ code: string; partner_id: string | null; note: string | null; created_at: string; activated_at: string | null }[]>(
      "ks_display_boards?select=code,partner_id,note,created_at,activated_at&order=created_at.desc&limit=200",
    );
    const batches = await rest<{ id: string; label: string; quantity: number; partner_id: string | null; created_at: string }[]>(
      "ks_tag_batches?select=id,label,quantity,partner_id,created_at&order=created_at.desc&limit=200",
    );
    const names = new Map(rows.map((r) => [r.id, r.name]));
    return Response.json({
      ok: true,
      partners: rows.map(({ claim_token, ...r }, i) => ({
        ...r, kindLabel: KID_KINDS[r.kind] || "Other", link: r.slug ? kidPartnerLink(r.slug) : null, stats: stats[i],
        hasAccount: !!r.owner_id, inviteUrl: !r.owner_id && claim_token ? kidPartnerInviteUrl(claim_token) : null,
      })),
      boards: boards.map((b) => ({ ...b, link: kidBoardLink(b.code), partner: b.partner_id ? names.get(b.partner_id) || null : null })),
      batches: batches.map((b) => ({ ...b, partner: b.partner_id ? names.get(b.partner_id) || null : null })),
    });
  } catch (e) {
    console.error("[kids/admin] get", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "Couldn't load the desk." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json(FORBIDDEN, { status: 401 });
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  const now = new Date().toISOString();
  try {
    switch (b.action) {
      case "create": {
        const name = cleanText(b.name, 80);
        const email = cleanText(b.email, 200).toLowerCase();
        if (name.length < 2) return Response.json({ ok: false, error: "Add the business name." }, { status: 400 });
        if (!EMAIL_RE.test(email)) return Response.json({ ok: false, error: "Add an email for them." }, { status: 400 });
        const token = newKidClaimToken();
        const [row] = await rest<KidPartnerRow[]>("ks_partners", {
          method: "POST",
          body: JSON.stringify({
            name, email, slug: await uniqueKidSlug(name), status: "approved", approved_at: now, claim_token: token,
            kind: typeof b.kind === "string" && b.kind in KID_KINDS ? b.kind : "other",
            contact_name: cleanText(b.contactName, 80) || null, phone: cleanText(b.phone, 30) || null, address: cleanText(b.address, 200) || null,
            admin_note: "Added by the owner",
          }),
          prefer: "return=representation",
        });
        return Response.json({ ok: true, id: row.id, inviteUrl: kidPartnerInviteUrl(token) });
      }
      case "board": {
        const partnerId = typeof b.partnerId === "string" && b.partnerId ? b.partnerId : null;
        for (let i = 0; i < 5; i += 1) {
          const code = newKidBoardCode();
          const rows = await rest<{ code: string }[]>("ks_display_boards?on_conflict=code", {
            method: "POST",
            body: JSON.stringify({ code, note: cleanText(b.note, 200) || null, created_by: admin.id, partner_id: partnerId, activated_at: partnerId ? now : null }),
            prefer: "resolution=ignore-duplicates,return=representation",
          });
          if (rows.length) return Response.json({ ok: true, code, link: kidBoardLink(code) });
        }
        return Response.json({ ok: false, error: "Couldn't make a display code. Try again." }, { status: 503 });
      }
      case "mint": {
        const quantity = Math.floor(Number(b.quantity));
        if (!Number.isFinite(quantity) || quantity < 1 || quantity > 500) return Response.json({ ok: false, error: "Make between 1 and 500 tags." }, { status: 400 });
        const partnerId = typeof b.partnerId === "string" && b.partnerId ? b.partnerId : null;
        if (partnerId && !(await loadKidPartner(partnerId))) return Response.json({ ok: false, error: "Unknown partner." }, { status: 404 });
        const made = await mintKidBatch({ quantity, label: cleanText(b.label, 80), partnerId, createdBy: admin.id });
        return Response.json({ ok: true, batchId: made.id, made: made.codes.length });
      }
    }

    const p = await loadKidPartner(String(b.id || ""));
    if (!p) return Response.json({ ok: false, error: "Unknown partner." }, { status: 404 });
    const patch = (body: Record<string, unknown>) =>
      rest(`ks_partners?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ ...body, updated_at: now }), prefer: "return=minimal" });

    switch (b.action) {
      case "approve": {
        const slug = p.slug || (await uniqueKidSlug(p.name, p.id));
        await patch({ status: "approved", slug, approved_at: p.approved_at || now });
        if (emailConfigured() && p.email) {
          await sendEmail({ to: p.email, from: KID_EMAIL_FROM, ...kidPartnerApprovedEmail({ name: p.name, link: kidPartnerLink(slug), dashboardUrl: KID_DASHBOARD_URL }) })
            .catch((e) => console.error("[kids/admin] approve email", e instanceof Error ? e.message : e));
        }
        return Response.json({ ok: true });
      }
      case "pause": await patch({ status: "paused" }); return Response.json({ ok: true });
      case "resume": await patch({ status: "approved" }); return Response.json({ ok: true });
      case "decline": await patch({ status: "declined" }); return Response.json({ ok: true });
      case "note": await patch({ admin_note: cleanText(b.note, 500) || null }); return Response.json({ ok: true });
      case "boardSent": await patch({ board_sent_at: now }); return Response.json({ ok: true });
      case "invite": {
        if (p.owner_id) return Response.json({ ok: false, error: "They already run their dashboard." }, { status: 409 });
        let token = (await rest<{ claim_token: string | null }[]>(`ks_partners?select=claim_token&id=eq.${p.id}`))[0]?.claim_token || null;
        if (!token || b.fresh === true) { token = newKidClaimToken(); await patch({ claim_token: token }); }
        const inviteUrl = kidPartnerInviteUrl(token);
        if (!emailConfigured()) return Response.json({ ok: true, inviteUrl, emailed: false });
        await sendEmail({ to: p.email, from: KID_EMAIL_FROM, ...kidPartnerInviteEmail({ name: p.name, inviteUrl }) });
        return Response.json({ ok: true, inviteUrl, emailed: true });
      }
    }
    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("[kids/admin] post", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "That didn't save. Please try again." }, { status: 503 });
  }
}
