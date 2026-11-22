// The business side of a Kid Safe counter display (same as FurFriend's /api/partners/activate).
// GET  ?board=CODE → is it free to activate, or whose is it (no private details).
// POST {board, name, kind, contactName, email, phone, address} → the signed-in manager takes the
//      display and is a partner at once. The display in their hands is the vetting.

import { cleanText, rest, signedInUser } from "@/lib/tagserver";
import {
  KID_ADMIN_URL, KID_DASHBOARD_URL, KID_KINDS, attachKidBoard, adminNoticeRecipients, cleanKidBoardCode, kidPartnerForUser, kidPartnerLink,
  loadKidBoard, uniqueKidSlug, type KidPartnerRow,
} from "@/lib/kidpartners";
import { emailConfigured, KID_EMAIL_FROM, kidPartnerAdminEmail, kidPartnerApprovedEmail, sendEmail } from "@/lib/email";
import { adminEmails } from "@/lib/tagserver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const code = cleanKidBoardCode(new URL(request.url).searchParams.get("board"));
  if (!code) return Response.json({ ok: false, error: "That display code isn't complete." }, { status: 400 });
  try {
    const b = await loadKidBoard(code);
    if (!b) return Response.json({ ok: false, error: "We don't know that display." }, { status: 404 });
    let shop: string | null = null;
    if (b.partner_id) shop = (await rest<{ name: string }[]>(`ks_partners?select=name&id=eq.${b.partner_id}`))[0]?.name || null;
    return Response.json({ ok: true, board: b.code, activated: !!b.partner_id, shop });
  } catch {
    return Response.json({ ok: false, error: "Couldn't look up that display. Please try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ ok: false, error: "Make an account or sign in first, so the dashboard is yours." }, { status: 401 });
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  const code = cleanKidBoardCode(b.board);
  if (!code) return Response.json({ ok: false, error: "That display code isn't complete." }, { status: 400 });
  try {
    const board = await loadKidBoard(code);
    if (!board) return Response.json({ ok: false, error: "We don't know that display." }, { status: 404 });
    if (board.partner_id) return Response.json({ ok: false, error: "This display is already active for a business." }, { status: 409 });

    let partner = await kidPartnerForUser(user.id);
    let isNew = false;
    let created = false;
    if (partner && (partner.status === "paused" || partner.status === "declined")) {
      return Response.json({ ok: false, error: "This account's partnership is on hold. Email us and we'll sort it out." }, { status: 409 });
    }
    if (partner && partner.status === "applied") {
      const slug = await uniqueKidSlug(partner.name, partner.id);
      await rest(`ks_partners?id=eq.${partner.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved", slug, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
        prefer: "return=minimal",
      });
      partner = { ...partner, status: "approved", slug };
      isNew = true;
    }
    if (!partner) {
      const name = cleanText(b.name, 80);
      const email = (cleanText(b.email, 200) || user.email || "").toLowerCase();
      if (name.length < 2) return Response.json({ ok: false, error: "Add your business name." }, { status: 400 });
      if (!EMAIL_RE.test(email)) return Response.json({ ok: false, error: "Add an email we can reach you at." }, { status: 400 });
      const slug = await uniqueKidSlug(name);
      [partner] = await rest<KidPartnerRow[]>("ks_partners", {
        method: "POST",
        body: JSON.stringify({
          name, slug, email, owner_id: user.id, status: "approved", approved_at: new Date().toISOString(),
          kind: typeof b.kind === "string" && b.kind in KID_KINDS ? b.kind : "other",
          interest: ["display", "stock", "both"].includes(String(b.interest)) ? String(b.interest) : "both",
          contact_name: cleanText(b.contactName, 80) || null,
          phone: cleanText(b.phone, 30) || null,
          address: cleanText(b.address, 200) || null,
          admin_note: `Activated display ${code}`,
        }),
        prefer: "return=representation",
      });
      isNew = true;
      created = true;
    }

    if (!(await attachKidBoard(code, partner.id))) {
      if (created) await rest(`ks_partners?id=eq.${partner.id}`, { method: "DELETE", prefer: "return=minimal" }).catch(() => {});
      return Response.json({ ok: false, error: "This display was just activated by someone else." }, { status: 409 });
    }

    if (emailConfigured()) {
      try {
        if (isNew && partner.email && partner.slug) {
          await sendEmail({ to: partner.email, from: KID_EMAIL_FROM, ...kidPartnerApprovedEmail({ name: partner.name, link: kidPartnerLink(partner.slug), dashboardUrl: KID_DASHBOARD_URL }) });
        }
        const mail = kidPartnerAdminEmail({
          headline: `activated display ${code}${isNew ? " (new partner)" : ""}`, name: partner.name, kind: KID_KINDS[partner.kind] || "Other",
          contact: [partner.contact_name, partner.email, partner.phone].filter(Boolean).join(", "), deskUrl: KID_ADMIN_URL,
        });
        for (const to of await adminNoticeRecipients(partner.email, adminEmails)) await sendEmail({ to, from: KID_EMAIL_FROM, ...mail });
      } catch (e) {
        console.error("[kids/partners] activate email", e instanceof Error ? e.message : e);
      }
    }
    return Response.json({ ok: true, name: partner.name, slug: partner.slug, isNew });
  } catch (e) {
    console.error("[kids/partners] activate", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "Couldn't activate the display. Please try again." }, { status: 503 });
  }
}
