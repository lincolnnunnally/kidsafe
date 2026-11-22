// POST /api/kids/partners/apply: a signed-in business applies to be a Kid Safe partner (same as
// FurFriend's /api/partners/apply). An admin approves it at kidsafe.unitedundergod.org/admin.

import { signedInUser, cleanText, rest } from "@/lib/tagserver";
import { KID_ADMIN_URL, KID_KINDS, adminNoticeRecipients, kidPartnerForUser, type KidPartnerRow } from "@/lib/kidpartners";
import { emailConfigured, KID_EMAIL_FROM, kidPartnerAdminEmail, kidPartnerAppliedEmail, sendEmail } from "@/lib/email";
import { adminEmails } from "@/lib/tagserver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ ok: false, error: "Sign in first, so your dashboard is yours." }, { status: 401 });
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  try {
    if (await kidPartnerForUser(user.id)) return Response.json({ ok: false, error: "This account already has a partner application." }, { status: 409 });
    const name = cleanText(b.name, 80);
    const email = (cleanText(b.email, 200) || user.email || "").toLowerCase();
    if (name.length < 2) return Response.json({ ok: false, error: "Add your business name." }, { status: 400 });
    if (!EMAIL_RE.test(email)) return Response.json({ ok: false, error: "Add an email we can reach you at." }, { status: 400 });
    const kind = typeof b.kind === "string" && b.kind in KID_KINDS ? b.kind : "other";
    const interest = ["display", "stock", "both"].includes(String(b.interest)) ? String(b.interest) : "both";
    const wantsBoard = b.wantsBoard === true;
    const address = cleanText(b.address, 200);
    if (wantsBoard && address.length < 8) return Response.json({ ok: false, error: "Add your address, so we can bring or ship your display." }, { status: 400 });
    const [row] = await rest<KidPartnerRow[]>("ks_partners", {
      method: "POST",
      body: JSON.stringify({
        name, kind, email, interest, owner_id: user.id, status: "applied",
        contact_name: cleanText(b.contactName, 80) || null,
        phone: cleanText(b.phone, 30) || null,
        address: address || null,
        website: cleanText(b.website, 200) || null,
        board_requested_at: wantsBoard ? new Date().toISOString() : null,
        note: cleanText(b.note, 500) || null,
      }),
      prefer: "return=representation",
    });
    if (emailConfigured()) {
      try {
        await sendEmail({ to: email, from: KID_EMAIL_FROM, ...kidPartnerAppliedEmail({ name }) });
        const mail = kidPartnerAdminEmail({
          headline: "new application", name, kind: KID_KINDS[kind],
          contact: [cleanText(b.contactName, 80), email, cleanText(b.phone, 30)].filter(Boolean).join(", "),
          detail: `Wants: ${interest}${wantsBoard ? "; a counter display" : ""}.`, deskUrl: KID_ADMIN_URL,
        });
        for (const to of await adminNoticeRecipients(email, adminEmails)) await sendEmail({ to, from: KID_EMAIL_FROM, ...mail });
      } catch (e) {
        console.error("[kids/partners] apply email", e instanceof Error ? e.message : e);
      }
    }
    return Response.json({ ok: true, status: row.status });
  } catch (e) {
    console.error("[kids/partners] apply", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "Couldn't send your application. Please try again." }, { status: 503 });
  }
}
