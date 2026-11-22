// Server-only Kid Safe reads: what a staff member sees when they scan a child's tag, and what the
// shared "missing child" page shows. Uses the service-role REST helper
// (lib/tagserver.ts); nothing here runs in the browser.

import { rest } from "@/lib/tagserver";
import { ageFrom } from "@/lib/kidsafe-shared";
import { kidTagPartnerName } from "@/lib/kidpartners";

type FamilyRow = {
  owner_id: string;
  contact_name: string | null;
  phone: string | null;
  backup_name: string | null;
  backup_phone: string | null;
  parent_photo_url: string | null;
  show_parent_photo: boolean;
  text_alerts: boolean;
};

export type ChildRow = {
  id: string;
  owner_id: string;
  first_name: string;
  birth_year: number | null;
  photo_url: string | null;
  photo_at: string | null;
  looks: string | null;
  wearing: string | null;
  wearing_at: string | null;
  needs_note: string | null;
  show_name: boolean;
  show_photo: boolean;
  missing: boolean;
  missing_since: string | null;
  missing_message: string | null;
  last_seen: string | null;
  share_token: string | null;
  share_expires_at: string | null;
};

type TagRow = { code: string; owner_id: string | null; child_id: string | null };

const CHILD_COLS =
  "id,owner_id,first_name,birth_year,photo_url,photo_at,looks,wearing,wearing_at,needs_note,show_name,show_photo," +
  "missing,missing_since,missing_message,last_seen,share_token,share_expires_at";
const FAMILY_COLS = "owner_id,contact_name,phone,backup_name,backup_phone,parent_photo_url,show_parent_photo,text_alerts";

export type KidContact = {
  contactName: string | null;
  phone: string | null;
  backup: { name: string | null; phone: string } | null;
  parentPhotoUrl: string | null;
};

/** What the scan page may show. The child's name and photo appear only if the parent chose, or while missing. */
export type KidScanView =
  | { status: "missing" }
  /** A blank tag nobody has registered yet (a partner's stock), or one whose child was removed. */
  | { status: "unlinked"; code: string; partnerName?: string | null }
  | ({
      status: "linked";
      code: string;
      demo?: boolean;
      missing: boolean;
      missingSince: string | null;
      missingMessage: string | null;
      childName: string | null;
      childPhotoUrl: string | null;
      age: number | null;
      /** Allergies, medicine, "nonverbal": always shown, because staff need it to keep the child safe. */
      needsNote: string | null;
    } & KidContact);

/** The shared page a parent sends to staff or police. Everything that helps someone spot the child. */
export type KidShareView =
  | { status: "gone" }
  | ({
      status: "shared";
      demo?: boolean;
      childName: string;
      age: number | null;
      photoUrl: string | null;
      photoAt: string | null;
      looks: string | null;
      wearing: string | null;
      wearingAt: string | null;
      needsNote: string | null;
      missing: boolean;
      missingSince: string | null;
      missingMessage: string | null;
      lastSeen: string | null;
      expiresAt: string | null;
    } & KidContact);

export async function loadKidTag(code: string): Promise<TagRow | null> {
  const rows = await rest<TagRow[]>(`ks_tags?select=code,owner_id,child_id&code=eq.${code}`);
  return rows[0] || null;
}

export async function loadChild(id: string): Promise<ChildRow | null> {
  const rows = await rest<ChildRow[]>(`ks_children?select=${CHILD_COLS}&id=eq.${id}`);
  return rows[0] || null;
}

export async function loadFamily(ownerId: string): Promise<FamilyRow | null> {
  const rows = await rest<FamilyRow[]>(`ks_families?select=${FAMILY_COLS}&owner_id=eq.${ownerId}`);
  return rows[0] || null;
}

function contactOf(family: FamilyRow | null): KidContact {
  return {
    contactName: family?.contact_name || null,
    phone: family?.phone || null,
    backup: family?.backup_phone ? { name: family.backup_name || null, phone: family.backup_phone } : null,
    parentPhotoUrl: family?.show_parent_photo ? family.parent_photo_url || null : null,
  };
}

/* ------------------------------- samples ------------------------------- */
// kidsafe.unitedundergod.org/t/demo (a child marked missing) and /t/demohome (an everyday tag),
// and /s/demo (the shared page). Fictional family: nothing is saved, texted or emailed.

const hoursAgo = (n: number) => new Date(Date.now() - n * 36e5).toISOString();

const DEMO_CONTACT: KidContact = {
  contactName: "Sarah",
  phone: "555-010-0123",
  backup: { name: "Grandpa Joe", phone: "555-010-0145" },
  parentPhotoUrl: null,
};

export const KID_DEMO_SCANS: Record<string, KidScanView> = {
  DEMO: {
    status: "linked", code: "DEMO", demo: true, missing: true, missingSince: hoursAgo(0.3),
    missingMessage: "We got separated by the carousel. She knows to wait with someone in a uniform.",
    childName: "Emma", childPhotoUrl: null, age: 6,
    needsNote: "Allergic to peanuts (EpiPen in her backpack).", ...DEMO_CONTACT,
  },
  DEMOHOME: {
    status: "linked", code: "DEMOHOME", demo: true, missing: false, missingSince: null, missingMessage: null,
    childName: null, childPhotoUrl: null, age: 5,
    needsNote: "Nonverbal. He may not answer questions, and loud noises upset him. Please stay with him.", ...DEMO_CONTACT,
  },
};

export const KID_DEMO_SHARE: KidShareView = {
  status: "shared", demo: true, childName: "Emma", age: 6, photoUrl: null, photoAt: hoursAgo(14),
  looks: "Light brown hair in two braids, about 3 and a half feet tall, missing a front tooth",
  wearing: "Yellow raincoat, purple leggings, pink light-up sneakers", wearingAt: hoursAgo(5),
  needsNote: "Allergic to peanuts (EpiPen in her backpack).",
  missing: true, missingSince: hoursAgo(0.3),
  missingMessage: "We got separated by the carousel. She knows to wait with someone in a uniform.",
  lastSeen: "By the carousel near the front gate", expiresAt: hoursAgo(-48), ...DEMO_CONTACT,
};

export function isKidDemoCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(KID_DEMO_SCANS, code);
}

/* -------------------------------- views -------------------------------- */

export async function kidScanView(code: string): Promise<KidScanView> {
  if (isKidDemoCode(code)) return KID_DEMO_SCANS[code];
  const tag = await loadKidTag(code);
  if (!tag) return { status: "missing" };
  const child = tag.child_id ? await loadChild(tag.child_id) : null;
  if (!tag.owner_id || !child) return { status: "unlinked", code, partnerName: tag.owner_id ? null : await kidTagPartnerName(code) };
  const family = await loadFamily(child.owner_id);
  return {
    status: "linked",
    code,
    missing: child.missing,
    missingSince: child.missing ? child.missing_since : null,
    missingMessage: child.missing ? child.missing_message || null : null,
    childName: child.show_name || child.missing ? child.first_name : null,
    childPhotoUrl: child.show_photo || child.missing ? child.photo_url || null : null,
    age: ageFrom(child.birth_year),
    needsNote: child.needs_note || null,
    ...contactOf(family),
  };
}

export async function kidShareView(token: string): Promise<KidShareView> {
  const clean = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean === "demo") return KID_DEMO_SHARE;
  if (clean.length < 10 || clean.length > 32) return { status: "gone" };
  const rows = await rest<ChildRow[]>(
    `ks_children?select=${CHILD_COLS}&share_token=eq.${clean}&share_expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
  );
  const child = rows[0];
  if (!child) return { status: "gone" };
  const family = await loadFamily(child.owner_id);
  return {
    status: "shared",
    childName: child.first_name,
    age: ageFrom(child.birth_year),
    photoUrl: child.photo_url || null,
    photoAt: child.photo_at,
    looks: child.looks || null,
    wearing: child.wearing || null,
    wearingAt: child.wearing ? child.wearing_at : null,
    needsNote: child.needs_note || null,
    missing: child.missing,
    missingSince: child.missing ? child.missing_since : null,
    missingMessage: child.missing ? child.missing_message || null : null,
    lastSeen: child.last_seen || null,
    expiresAt: child.share_expires_at,
    ...contactOf(family),
  };
}
