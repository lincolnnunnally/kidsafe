"use client";

// Photo uploads: a child's photo and a parent's photo, from the phone's camera roll, straight into
// Kid Safe's own Supabase Storage bucket. Nothing goes through another company's server.
//
// Layout: kidsafe-photos/<uid>/<kind>/<uuid>.<ext>. Storage RLS ties every read, write and delete to
// the first path segment being the signed-in uid, and nobody can list the bucket; see
// supabase/migrations/20261121010000_kidsafe_photos.sql.

import { getSupabase } from "@/lib/supabase";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB — plenty for a phone photo.

// The formats phones and cameras actually produce, mapped to the extension we store.
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};
const EXT_FALLBACK = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i;

/** "kids" / "kid-parents": Kid Safe's child and parent photos, kept in Kid Safe's own bucket. */
export type PhotoKind = "kids" | "kid-parents";

/** Kid Safe's own bucket, which nobody can list (supabase/migrations/20261121010000_kidsafe_photos.sql). */
export const KID_PHOTO_BUCKET = "kidsafe-photos";

function bucketFor(_kind: PhotoKind): string {
  return KID_PHOTO_BUCKET;
}

function extFor(file: File): string | null {
  const byType = EXT_BY_TYPE[file.type.toLowerCase()];
  if (byType) return byType;
  // Some Android pickers hand us an empty type — fall back to the filename.
  const m = file.name.match(EXT_FALLBACK);
  if (m) return m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
  return null;
}

// Upload one photo and hand back its public URL. Throws a friendly, showable message.
export async function uploadImage(uid: string, file: File, kind: PhotoKind): Promise<string> {
  const s = getSupabase();
  if (!s) throw new Error("Photo storage isn't connected right now. Please try again shortly.");

  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("That file isn't a photo. A JPG, PNG, HEIC, or WebP works great.");
  }
  const ext = extFor(file);
  if (!ext) throw new Error("We can't read that image format. A JPG, PNG, HEIC, or WebP works great.");
  if (file.size > MAX_PHOTO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`That photo is ${mb}MB — a little big for us. Please pick one under 5MB.`);
  }

  const path = `${uid}/${kind}/${crypto.randomUUID()}.${ext}`;
  const bucket = bucketFor(kind);
  const { error } = await s.storage.from(bucket).upload(path, file, {
    contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(error.message || "Couldn't upload that photo. Please try again.");

  const { data } = s.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Photo saved, but we couldn't get a link for it. Please try again.");
  return data.publicUrl;
}

// Best-effort tidy-up for a photo uploaded a moment ago and then removed/replaced
// before saving, so we don't leave orphans in the bucket. Never blocks the person.
export async function deleteUploadedImage(publicUrl: string): Promise<void> {
  const s = getSupabase();
  if (!s) return;
  for (const bucket of [KID_PHOTO_BUCKET]) {
    const marker = `/object/public/${bucket}/`;
    const at = publicUrl.indexOf(marker);
    if (at === -1) continue; // Not this bucket's (or a pasted link): leave it alone.
    const path = decodeURIComponent(publicUrl.slice(at + marker.length).split("?")[0]);
    if (!path) return;
    try { await s.storage.from(bucket).remove([path]); } catch { /* ignore */ }
    return;
  }
}
