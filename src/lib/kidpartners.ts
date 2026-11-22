// Kid Safe partners (server only): FurFriend's partner path (lib/partners.ts, lib/boards.ts) for
// places parents go: daycares, pediatric offices, kids' stores, sports facilities, amusement parks,
// cruise lines, hotels (owner, 2026-11-21). Two ways, as with FurFriend:
//   display: a counter display or the partner's link (kidsafe.unitedundergod.org/p/SLUG) sends
//            parents to Kid Safe; families who join are credited to the partner.
//   stock:   blank tags (no name, no phone) the partner hands out; a parent scans one and
//            registers it to their child on the spot (ks_claim_tag).
// Prices and the partner's share aren't set yet, so nothing here moves money.

import { randomBytes } from "node:crypto";
import { rest } from "@/lib/tagserver";
import { KID_TAG_BASE } from "@/lib/kidsafe-shared";

export const KID_PARTNER_COOKIE = "ks_partner";
export const KID_PARTNER_COOKIE_DAYS = 30;

export type KidPartnerStatus = "applied" | "approved" | "paused" | "declined";

export type KidPartnerRow = {
  id: string;
  slug: string | null;
  name: string;
  kind: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  interest: "display" | "stock" | "both";
  status: KidPartnerStatus;
  owner_id: string | null;
  visits: number;
  board_requested_at: string | null;
  board_sent_at: string | null;
  note: string | null;
  admin_note: string | null;
  created_at: string;
  approved_at: string | null;
};

export const KID_PARTNER_COLS =
  "id,slug,name,kind,contact_name,email,phone,address,website,interest,status,owner_id,visits," +
  "board_requested_at,board_sent_at,note,admin_note,created_at,approved_at";

export const KID_KINDS: Record<string, string> = {
  daycare: "Daycare or preschool",
  pediatrician: "Pediatric office",
  dentist: "Kids' dentist",
  kids_store: "Kids' clothing store",
  toy_store: "Toy store",
  sports: "Sports facility",
  school: "School",
  church: "Church",
  amusement: "Amusement park",
  cruise: "Cruise line",
  hotel: "Hotel or resort",
  camp: "Camp",
  other: "Other",
};

export const kidPartnerLink = (slug: string) => `${KID_TAG_BASE}/p/${slug}`;
export const kidBoardLink = (code: string) => `${KID_TAG_BASE}/b/${code.toLowerCase()}`;
export const kidPartnerInviteUrl = (token: string) => `${KID_TAG_BASE}/partners/dashboard?claim=${token}`;
export const KID_DASHBOARD_URL = `${KID_TAG_BASE}/partners/dashboard`;
export const KID_ADMIN_URL = `${KID_TAG_BASE}/admin`;

export function kidSlugify(name: string): string {
  const s = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/g, "");
  return s.length >= 3 ? s : `${s}-kids`.slice(0, 24);
}

export function cleanKidSlug(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{2,23}$/.test(s) ? s : null;
}

export async function uniqueKidSlug(wanted: string, exceptId?: string): Promise<string> {
  const base = kidSlugify(wanted);
  for (let i = 1; i < 50; i += 1) {
    const s = i === 1 ? base : `${base.slice(0, 21)}-${i}`;
    const rows = await rest<{ id: string }[]>(`ks_partners?select=id&slug=eq.${encodeURIComponent(s)}`);
    if (!rows.length || rows[0].id === exceptId) return s;
  }
  return `${base.slice(0, 17)}-${Date.now().toString(36).slice(-6)}`;
}

export async function approvedKidPartner(slug: unknown): Promise<KidPartnerRow | null> {
  const s = cleanKidSlug(slug);
  if (!s) return null;
  const rows = await rest<KidPartnerRow[]>(`ks_partners?select=${KID_PARTNER_COLS}&slug=eq.${s}&status=eq.approved`);
  return rows[0] || null;
}

export async function kidPartnerForUser(userId: string): Promise<KidPartnerRow | null> {
  const rows = await rest<KidPartnerRow[]>(`ks_partners?select=${KID_PARTNER_COLS}&owner_id=eq.${userId}`);
  return rows[0] || null;
}

export async function loadKidPartner(id: string): Promise<KidPartnerRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await rest<KidPartnerRow[]>(`ks_partners?select=${KID_PARTNER_COLS}&id=eq.${id}`);
  return rows[0] || null;
}

export async function recordKidVisit(partnerId: string): Promise<void> {
  try {
    await rest("rpc/ks_partner_visit", { method: "POST", body: JSON.stringify({ pid: partnerId }), prefer: "return=minimal" });
  } catch { /* a missed count never blocks a parent */ }
}

export function newKidClaimToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Set-Cookie value that remembers which partner sent a parent (30 days). */
export function kidPartnerCookie(slug: string): string {
  return `${KID_PARTNER_COOKIE}=${slug}; Path=/; Max-Age=${KID_PARTNER_COOKIE_DAYS * 86400}; SameSite=Lax; Secure`;
}

export function partnerSlugFromCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${KID_PARTNER_COOKIE}=([a-z0-9-]{3,24})`));
  return m ? m[1] : null;
}

/* ------------------------------ what a partner sees ------------------------------ */

export type KidPartnerStats = {
  families: number;
  blankTags: number;
  tagsRegistered: number;
  visits: number;
  batches: { id: string; label: string; quantity: number; registered: number; created_at: string }[];
};

export async function kidPartnerStats(p: Pick<KidPartnerRow, "id" | "visits">): Promise<KidPartnerStats> {
  const [families, batches] = await Promise.all([
    rest<{ owner_id: string }[]>(`ks_families?select=owner_id&partner_id=eq.${p.id}&limit=5000`),
    rest<{ id: string; label: string; quantity: number; created_at: string }[]>(
      `ks_tag_batches?select=id,label,quantity,created_at&partner_id=eq.${p.id}&order=created_at.desc&limit=100`,
    ),
  ]);
  const registeredBy = new Map<string, number>();
  if (batches.length) {
    const claimed = await rest<{ batch_id: string }[]>(
      `ks_tags?select=batch_id&batch_id=in.(${batches.map((b) => b.id).join(",")})&owner_id=not.is.null&limit=10000`,
    );
    for (const c of claimed) registeredBy.set(c.batch_id, (registeredBy.get(c.batch_id) || 0) + 1);
  }
  const rows = batches.map((b) => ({ ...b, registered: registeredBy.get(b.id) || 0 }));
  return {
    families: families.length,
    blankTags: rows.reduce((n, b) => n + b.quantity, 0),
    tagsRegistered: rows.reduce((n, b) => n + b.registered, 0),
    visits: p.visits,
    batches: rows,
  };
}

/* ------------------------------ blank tags ------------------------------ */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(n: number): string {
  const bytes = randomBytes(n);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Mint `quantity` blank kid tag codes into a new batch (for a partner, or the owner's own stock). */
export async function mintKidBatch(opts: { quantity: number; label: string; partnerId: string | null; createdBy: string }): Promise<{ id: string; codes: string[] }> {
  const [batch] = await rest<{ id: string }[]>("ks_tag_batches", {
    method: "POST",
    body: JSON.stringify({ label: opts.label.slice(0, 80), quantity: opts.quantity, partner_id: opts.partnerId, created_by: opts.createdBy }),
    prefer: "return=representation",
  });
  const made: string[] = [];
  for (let attempt = 0; attempt < 6 && made.length < opts.quantity; attempt += 1) {
    const codes = new Set<string>();
    while (codes.size < opts.quantity - made.length) codes.add(randomCode(7));
    const inserted = await rest<{ code: string }[]>("ks_tags?on_conflict=code", {
      method: "POST",
      body: JSON.stringify([...codes].map((code) => ({ code, batch_id: batch.id }))),
      prefer: "resolution=ignore-duplicates,return=representation",
    });
    made.push(...inserted.map((r) => r.code));
  }
  return { id: batch.id, codes: made };
}

/** The approved partner a blank tag came from, for "Welcome to your new tag, from …". */
export async function kidTagPartnerName(code: string): Promise<string | null> {
  try {
    const rows = await rest<{ ks_tag_batches: { ks_partners: { name: string; status: string } | null } | null }[]>(
      `ks_tags?select=ks_tag_batches(ks_partners(name,status))&code=eq.${code}`,
    );
    const p = rows[0]?.ks_tag_batches?.ks_partners;
    return p && p.status === "approved" ? p.name : null;
  } catch {
    return null;
  }
}

/* ------------------------------ counter displays ------------------------------ */

export type KidBoardRow = { code: string; partner_id: string | null; note: string | null; created_at: string; activated_at: string | null };
const BOARD_COLS = "code,partner_id,note,created_at,activated_at";
const BOARD_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newKidBoardCode(): string {
  return Array.from(randomBytes(6), (b) => BOARD_ALPHABET[b % BOARD_ALPHABET.length]).join("");
}

export function cleanKidBoardCode(raw: unknown): string | null {
  const s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[2-9A-HJ-NP-Z]{6}$/.test(s) ? s : null;
}

export async function loadKidBoard(code: string): Promise<KidBoardRow | null> {
  const rows = await rest<KidBoardRow[]>(`ks_display_boards?select=${BOARD_COLS}&code=eq.${code}`);
  return rows[0] || null;
}

/** Give an unclaimed display to a partner, once (conditional update, like lib/boards.ts attachBoard). */
export async function attachKidBoard(code: string, partnerId: string): Promise<boolean> {
  const rows = await rest<{ code: string }[]>(`ks_display_boards?code=eq.${code}&partner_id=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ partner_id: partnerId, activated_at: new Date().toISOString() }),
    prefer: "return=representation",
  });
  return rows.length > 0;
}

/** Test accounts used by agents' end-to-end checks (QA addresses and Resend's delivery-test inbox). */
export const isTestEmail = (email: string | null | undefined) => /@(appengine\.test|resend\.dev)$/i.test(String(email || "").trim());

/**
 * Who gets an admin notice. A real business's notice goes to the owner's admin inbox. A test
 * account's notice is still SENT, to Resend's delivery-test inbox, so every check exercises the real
 * email and its links (the owner asked that nothing be hidden from him that isn't proven instead).
 */
export const TEST_ADMIN_INBOX = "delivered+kidsafe-admin@resend.dev";
export async function adminNoticeRecipients(partnerEmail: string | null | undefined, adminEmails: () => Promise<string[]>): Promise<string[]> {
  return isTestEmail(partnerEmail) ? [TEST_ADMIN_INBOX] : adminEmails();
}
