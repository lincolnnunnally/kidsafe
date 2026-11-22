// Kid Safe, parent side. Runs on the browser anon client under RLS: a parent reads and edits only
// their own family, children, tags and those tags' scans. Tag codes and share links come from
// security-definer functions (supabase/migrations/20261121000000_kidsafe.sql).

import { getSupabase } from "@/lib/supabase";

function db() {
  const s = getSupabase();
  if (!s) throw new Error("Kid Safe isn't connected to its database.");
  return s;
}

export type KidFamily = {
  owner_id: string;
  contact_name: string | null;
  phone: string | null;
  backup_name: string | null;
  backup_phone: string | null;
  parent_photo_url: string | null;
  show_parent_photo: boolean;
  text_alerts: boolean;
};

export type KidChild = {
  id: string;
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
  created_at: string;
};

export type KidTag = { code: string; child_id: string | null; label: string | null; created_at: string };

export type KidScan = {
  id: string;
  code: string;
  child_id: string | null;
  kind: "scan" | "location" | "message";
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  message: string | null;
  finder_contact: string | null;
  created_at: string;
};

export type ChildEdit = Partial<Pick<KidChild,
  "first_name" | "birth_year" | "photo_url" | "looks" | "wearing" | "needs_note" | "show_name" | "show_photo"
  | "missing" | "missing_message" | "last_seen">>;

export type FamilyEdit = Partial<Omit<KidFamily, "owner_id">>;

const CHILD_COLS =
  "id,first_name,birth_year,photo_url,photo_at,looks,wearing,wearing_at,needs_note,show_name,show_photo,missing," +
  "missing_since,missing_message,last_seen,share_token,share_expires_at,created_at";
const FAMILY_COLS = "owner_id,contact_name,phone,backup_name,backup_phone,parent_photo_url,show_parent_photo,text_alerts";

export async function fetchFamily(uid: string): Promise<KidFamily | null> {
  const { data, error } = await db().from("ks_families").select(FAMILY_COLS).eq("owner_id", uid).maybeSingle();
  if (error) throw new Error("Couldn't load your family.");
  return (data as unknown as KidFamily) || null;
}

export async function saveFamily(uid: string, edit: FamilyEdit): Promise<KidFamily> {
  const { data, error } = await db().from("ks_families").upsert({ owner_id: uid, ...edit }).select(FAMILY_COLS).single();
  if (error) throw new Error("Couldn't save your contact details.");
  return data as unknown as KidFamily;
}

export async function fetchChildren(): Promise<KidChild[]> {
  const { data, error } = await db().from("ks_children").select(CHILD_COLS).order("created_at");
  if (error) throw new Error("Couldn't load your children.");
  return (data || []) as unknown as KidChild[];
}

export async function addChild(uid: string, edit: ChildEdit & { first_name: string }): Promise<KidChild> {
  const { data, error } = await db().from("ks_children").insert({ owner_id: uid, ...edit }).select(CHILD_COLS).single();
  if (error) throw new Error("Couldn't add your child.");
  return data as unknown as KidChild;
}

export async function updateChild(id: string, edit: ChildEdit): Promise<KidChild> {
  const { data, error } = await db().from("ks_children").update(edit).eq("id", id).select(CHILD_COLS).single();
  if (error) throw new Error("Couldn't save that.");
  return data as unknown as KidChild;
}

/** Removes the child and their tags (and so those tags' scans). */
export async function deleteChild(id: string): Promise<void> {
  const tags = await db().from("ks_tags").delete().eq("child_id", id);
  if (tags.error) throw new Error("Couldn't remove that child's tags.");
  const { error } = await db().from("ks_children").delete().eq("id", id);
  if (error) throw new Error("Couldn't remove that child.");
}

export async function fetchKidTags(): Promise<KidTag[]> {
  const { data, error } = await db().from("ks_tags").select("code,child_id,label,created_at").order("created_at");
  if (error) throw new Error("Couldn't load your tags.");
  return (data || []) as KidTag[];
}

export async function makeKidTag(childId: string, label: string): Promise<KidTag> {
  const { data, error } = await db().rpc("ks_make_tag", { for_child: childId, tag_label: label || null });
  if (error) throw new Error(error.message || "Couldn't make a tag code.");
  return data as KidTag;
}

/** Removes a tag from the family: one they made is deleted, a blank one they registered goes back to blank. */
export async function removeKidTag(code: string): Promise<void> {
  const { error } = await db().rpc("ks_release_tag", { tag_code: code });
  if (error) throw new Error(error.message || "Couldn't remove that tag.");
}

/** Register a blank tag (from a partner or a shop) to one of your children. */
export async function claimKidTag(code: string, childId: string): Promise<KidTag> {
  const { data, error } = await db().rpc("ks_claim_tag", { tag_code: code, for_child: childId });
  if (error) throw new Error(error.message || "Couldn't set up that tag.");
  return data as KidTag;
}

/** "k7m 3qx" or a pasted kidsafe…/t/… link -> "K7M3QX", or "" if it can't be a code. */
export function cleanKidCode(raw: string): string {
  const fromLink = raw.match(/\/t\/([A-Za-z0-9-]+)/);
  const code = (fromLink ? fromLink[1] : raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : "";
}

/** Credit the partner whose display, link or blank tag brought this family (attribution only, once). */
export async function creditKidPartner(code?: string): Promise<void> {
  try {
    const token = (await db().auth.getSession()).data.session?.access_token;
    if (!token) return;
    await fetch("/api/kids/partners/credit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(code ? { code } : {}),
    });
  } catch { /* attribution never blocks a parent */ }
}

export async function fetchKidScans(limit = 30): Promise<KidScan[]> {
  const { data, error } = await db()
    .from("ks_tag_scans")
    .select("id,code,child_id,kind,city,region,lat,lng,message,finder_contact,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Couldn't load scans.");
  return (data || []) as KidScan[];
}

export async function shareChild(id: string, hours = 72): Promise<string> {
  const { data, error } = await db().rpc("ks_share_child", { for_child: id, hours });
  if (error) throw new Error(error.message || "Couldn't make a share link.");
  return String(data);
}

export async function stopSharing(id: string): Promise<void> {
  const { error } = await db().rpc("ks_stop_sharing", { for_child: id });
  if (error) throw new Error("Couldn't turn sharing off.");
}
