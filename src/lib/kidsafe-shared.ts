// Kid Safe constants and helpers used by both the browser and the server.
//
// Kid Safe is its own app (owner, 2026-11-22: "these are two separate apps. they just started from a
// central idea"). It answers at kidsafe.unitedundergod.org. The tag address is burned into wood and printed on wristbands, so once tags are
// out, KID_TAG_BASE must keep answering forever, even if Kid Safe later moves to its own domain.

export const KID_SITE_NAME = "Kid Safe";
export const KID_TAG_BASE = "https://kidsafe.unitedundergod.org";

export function kidTagUrl(code: string): string {
  return `${KID_TAG_BASE}/t/${code.toLowerCase()}`;
}

export function kidShareUrl(token: string): string {
  return `${KID_TAG_BASE}/s/${token.toLowerCase()}`;
}

/** "Sarah Lee" -> "Sarah"; "The Rivera family" stays whole. */
export function grownUpName(contactName: string | null | undefined): string {
  const n = (contactName || "").trim();
  if (!n) return "this child's family";
  return /^the\s/i.test(n) ? n.replace(/^The\b/, "the") : n.split(/\s+/)[0];
}

export function ageFrom(birthYear: number | null | undefined, now = new Date()): number | null {
  if (!birthYear) return null;
  const age = now.getFullYear() - birthYear;
  return age >= 0 && age < 30 ? age : null;
}

export function telHref(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/** The site name printed on tags, for typing in when a QR won't scan. */
export const KID_SITE_HOST = KID_TAG_BASE.replace(/^https?:\/\//, "");

/** "ABC1234" -> "ABC 1234": easier to read off a tag and type. Spaces are ignored when typed back. */
export function kidCodeDisplay(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length > 4 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}
