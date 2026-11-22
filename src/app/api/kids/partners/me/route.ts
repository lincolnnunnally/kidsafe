// GET  /api/kids/partners/me → the signed-in account's Kid Safe partnership and its numbers.
// PATCH /api/kids/partners/me {contactName, phone, address, website} or {requestBoard: true}.

import { signedInUser, cleanText, rest } from "@/lib/tagserver";
import { KID_ADMIN_URL, KID_KINDS, adminNoticeRecipients, kidPartnerForUser, kidPartnerLink, kidPartnerStats } from "@/lib/kidpartners";
import { emailConfigured, KID_EMAIL_FROM, kidPartnerAdminEmail, sendEmail } from "@/lib/email";
import { adminEmails } from "@/lib/tagserver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    const p = await kidPartnerForUser(user.id);
    if (!p) return Response.json({ ok: true, partner: null, email: user.email });
    const stats = p.status === "approved" ? await kidPartnerStats(p) : null;
    return Response.json({
      ok: true,
      email: user.email,
      partner: {
        name: p.name, kind: p.kind, kindLabel: KID_KINDS[p.kind] || "Other", status: p.status, slug: p.slug,
        contactName: p.contact_name, phone: p.phone, address: p.address, website: p.website, email: p.email,
        boardRequestedAt: p.board_requested_at, boardSentAt: p.board_sent_at,
        link: p.slug ? kidPartnerLink(p.slug) : null,
      },
      stats,
    });
  } catch (e) {
    console.error("[kids/partners] me", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "Couldn't load your dashboard. Please try again." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  try {
    const p = await kidPartnerForUser(user.id);
    if (!p) return Response.json({ ok: false, error: "This account isn't a partner yet." }, { status: 404 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (b.requestBoard === true) {
      const address = cleanText(b.address, 200) || p.address || "";
      if (address.length < 8) return Response.json({ ok: false, error: "Add your address first." }, { status: 400 });
      patch.board_requested_at = new Date().toISOString();
      patch.address = address;
    } else {
      if ("contactName" in b) patch.contact_name = cleanText(b.contactName, 80) || null;
      if ("phone" in b) patch.phone = cleanText(b.phone, 30) || null;
      if ("address" in b) patch.address = cleanText(b.address, 200) || null;
      if ("website" in b) patch.website = cleanText(b.website, 200) || null;
    }
    await rest(`ks_partners?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify(patch), prefer: "return=minimal" });
    if (b.requestBoard === true && emailConfigured()) {
      try {
        const mail = kidPartnerAdminEmail({
          headline: "asked for a counter display", name: p.name, kind: KID_KINDS[p.kind] || "Other",
          contact: [p.contact_name, p.email, p.phone].filter(Boolean).join(", "), detail: `Address: ${patch.address}`, deskUrl: KID_ADMIN_URL,
        });
        for (const to of await adminNoticeRecipients(p.email, adminEmails)) await sendEmail({ to, from: KID_EMAIL_FROM, ...mail });
      } catch (e) {
        console.error("[kids/partners] board email", e instanceof Error ? e.message : e);
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[kids/partners] patch", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "Couldn't save. Please try again." }, { status: 503 });
  }
}
