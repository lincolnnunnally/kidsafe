// The helper's side of a Kid Safe tag (kidsafe.unitedundergod.org/t/CODE).
//
// POST { action: "scan" }                     record a scan; text and email the parent
//      { action: "location", lat, lng }        the helper chose to share their exact spot
//      { action: "message", message, contact } the helper sends the parent a note
//
// Same flow as the pet tags (app/api/tags/[code]/route.ts): the scan is recorded by the page's
// script after it loads, so link previews don't count as someone finding a child. A text goes out
// as well as the email when the parent turned on text alerts and a sending number is set up
// (lib/sms.ts); a text or mail problem never tells the helper it failed.

import { clientIp, hashKey, rateLimit } from "@/lib/ratelimit";
import { emailConfigured, sendEmail, kidAlertEmail, KID_EMAIL_FROM } from "@/lib/email";
import { smsConfigured, sendSms } from "@/lib/sms";
import { accountEmail, cleanText, finderKey, normalizeTagCode, rest, serviceReady, townFromRequest, townLabel } from "@/lib/tagserver";
import { isKidDemoCode, loadChild, loadFamily, loadKidTag } from "@/lib/kidsafe";
import { KID_TAG_BASE } from "@/lib/kidsafe-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = { ok: false, error: "We couldn't find that tag. Check the letters printed under the QR code." };
const UNAVAILABLE = { ok: false, error: "Kid Safe isn't answering right now. Please call the number on the tag." };
/** One scan alert per helper per tag in this window, so reloading the page doesn't flood the parent. */
const SCAN_DEDUPE_MS = 10 * 60 * 1000;

function kidOrigin(): string {
  return (process.env.KIDSAFE_ORIGIN || KID_TAG_BASE).replace(/\/+$/, "");
}

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = normalizeTagCode((await ctx.params).code);
  if (!code) return Response.json(NOT_FOUND, { status: 404 });

  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const action = body.action;
  if (action !== "scan" && action !== "location" && action !== "message") {
    return Response.json({ ok: false, error: "That isn't something this tag can do." }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website.trim()) return Response.json({ ok: true });

  const limited = rateLimit(`ks-tag:${action}:${hashKey(clientIp(request))}`, action === "scan" ? 30 : 8, 10 * 60 * 1000);
  if (!limited.ok) {
    return Response.json(
      { ok: false, error: "That's a lot of tries. Please wait a minute, or call the number on the tag." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (isKidDemoCode(code)) return Response.json({ ok: true, recorded: false, demo: true });
  if (!serviceReady()) return Response.json(UNAVAILABLE, { status: 503 });

  try {
    const tag = await loadKidTag(code);
    if (!tag) return Response.json(NOT_FOUND, { status: 404 });
    if (!tag.owner_id || !tag.child_id) return Response.json({ ok: true, recorded: false });
    const child = await loadChild(tag.child_id);
    if (!child) return Response.json({ ok: true, recorded: false });

    const finder = finderKey(request, body.finder);
    const { city, region } = townFromRequest(request);
    const row: Record<string, unknown> = { code, child_id: child.id, kind: action, city, region, finder_key: finder };
    let mapUrl: string | null = null;
    let message: string | null = null;
    let finderContact: string | null = null;
    let accuracyM: number | null = null;

    if (action === "scan") {
      const since = new Date(Date.now() - SCAN_DEDUPE_MS).toISOString();
      const recent = await rest<{ id: string }[]>(
        `ks_tag_scans?select=id&code=eq.${code}&kind=eq.scan&finder_key=eq.${finder}&created_at=gte.${encodeURIComponent(since)}&limit=1`,
      );
      if (recent.length) return Response.json({ ok: true, recorded: false });
    }

    if (action === "location") {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return Response.json({ ok: false, error: "We couldn't read that location. Please try again." }, { status: 400 });
      }
      row.lat = Math.round(lat * 10000) / 10000;
      row.lng = Math.round(lng * 10000) / 10000;
      mapUrl = `https://www.google.com/maps?q=${row.lat},${row.lng}`;
      const acc = Number(body.accuracy);
      if (Number.isFinite(acc) && acc > 0 && acc < 100000) accuracyM = Math.round(acc);
    }

    if (action === "message") {
      message = cleanText(body.message, 500);
      finderContact = cleanText(body.contact, 120) || null;
      if (!message) return Response.json({ ok: false, error: "Write a short message first." }, { status: 400 });
      row.message = message;
      row.finder_contact = finderContact;
    }

    await rest("ks_tag_scans", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });

    const town = townLabel(city, region);
    const manageUrl = `${kidOrigin()}/family`;
    const family = await loadFamily(child.owner_id).catch(() => null);

    // Text first: it is the one a panicking parent sees soonest.
    let texted = false;
    if (family?.text_alerts && family.phone && smsConfigured()) {
      const name = child.first_name;
      const text =
        action === "location" ? `Kid Safe: someone with ${name} shared where they are: ${mapUrl}`
        : action === "message" ? `Kid Safe message about ${name}: "${(message || "").slice(0, 300)}"${finderContact ? ` Reach them: ${finderContact}` : ""}`
        : `Kid Safe: ${name}'s tag was just scanned${town ? ` near ${town}` : ""}. They may be with ${name} now. ${manageUrl}`;
      try {
        await sendSms(family.phone, text);
        texted = true;
      } catch (e) {
        console.error("[kids] alert text", e instanceof Error ? e.message : e);
      }
    }

    let alerted = false;
    if (emailConfigured()) {
      try {
        const to = await accountEmail(child.owner_id);
        if (to) {
          const mail = kidAlertEmail({
            childName: child.first_name, kind: action, town, mapUrl, message, finderContact, accuracyM, manageUrl, missing: child.missing,
          });
          await sendEmail({ to, from: KID_EMAIL_FROM, ...mail });
          alerted = true;
        }
      } catch (e) {
        console.error("[kids] alert email", e instanceof Error ? e.message : e);
      }
    }
    return Response.json({ ok: true, recorded: true, alerted, texted });
  } catch (e) {
    console.error("[kids] post", e instanceof Error ? e.message : e);
    return Response.json(UNAVAILABLE, { status: 503 });
  }
}
