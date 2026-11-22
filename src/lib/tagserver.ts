// Server-only helpers for Kid Safe's API routes: the service-role REST client, the signed-in caller,
// admin check, and the finder's town. The service-role key lives here and in the /api routes, never in
// the browser (see the note in lib/supabase.ts). Started as a copy of FurFriend's lib/tagserver.ts.

import { createHash } from "node:crypto";

/** "k7m-3qx " -> "K7M3QX". Null when it can't be a tag code. */
export function normalizeTagCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
}

/* ----------------------------- service REST ----------------------------- */

function supaUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
}

export function serviceReady(): boolean {
  return Boolean(supaUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

export async function rest<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const { prefer, headers, ...rest } = init;
  const res = await fetch(`${supaUrl()}/rest/v1/${path}`, {
    ...rest,
    headers: serviceHeaders({ ...(prefer ? { Prefer: prefer } : {}), ...((headers as Record<string, string>) || {}) }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`rest_${res.status}: ${detail.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** The owner's sign-in email. Alerts go here, never to the email shown on the tag. */
export async function accountEmail(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${supaUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: serviceHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { email?: string | null };
    return user.email || null;
  } catch {
    return null;
  }
}

/** The signed-in caller, from the browser's Supabase access token (Authorization: Bearer …). */
export async function signedInUser(request: Request): Promise<{ id: string; email: string | null } | null> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!token || !anon || !serviceReady()) return null;
  try {
    const res = await fetch(`${supaUrl()}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; email?: string | null };
    return user.id ? { id: user.id, email: user.email || null } : null;
  } catch {
    return null;
  }
}

/** The signed-in caller, if they are an admin (the ecosystem admin list, ff_admin_users). */
export async function requireAdmin(request: Request): Promise<{ id: string } | null> {
  const user = await signedInUser(request);
  if (!user) return null;
  try {
    const rows = await rest<{ id: string }[]>(`ff_admin_users?select=id&id=eq.${user.id}`);
    return rows.length ? { id: user.id } : null;
  } catch {
    return null;
  }
}

/* ----------------------------- the finder ----------------------------- */

/**
 * Hashed "same finder" id. Prefers the random id the finder's browser keeps (phones change
 * IP between cell towers and Wi-Fi), else the request IP. Neither raw value is stored.
 * Same approach as Spark of Hope's trail (lib/trail/request.ts).
 */
export function finderKey(request: Request, browserId?: unknown): string {
  if (typeof browserId === "string" && /^[A-Za-z0-9-]{8,80}$/.test(browserId)) {
    return createHash("sha256").update(`ff-tag-browser:${browserId}`).digest("hex").slice(0, 32);
  }
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`ff-tag-finder:${ip}`).digest("hex").slice(0, 32);
}

/** Town from Vercel's network location headers. Coarse by design; null off Vercel. */
export function townFromRequest(request: Request): { city: string | null; region: string | null } {
  const decode = (v: string | null) => {
    if (!v) return "";
    try { return decodeURIComponent(v).trim(); } catch { return v.trim(); }
  };
  const city = decode(request.headers.get("x-vercel-ip-city"));
  const region = decode(request.headers.get("x-vercel-ip-country-region"));
  return {
    city: city && city.toLowerCase() !== "undefined" ? city.slice(0, 80) : null,
    region: region ? region.slice(0, 40) : null,
  };
}

export function townLabel(city: string | null, region: string | null): string | null {
  if (!city) return null;
  return region ? `${city}, ${region}` : city;
}

export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

/** Exact row count (reads the Content-Range header), so totals aren't capped at PostgREST's page size. */
export async function restCount(path: string): Promise<number> {
  const res = await fetch(`${supaUrl()}/rest/v1/${path}${path.includes("?") ? "&" : "?"}limit=1`, {
    headers: serviceHeaders({ Prefer: "count=exact" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`count_${res.status}`);
  const total = (res.headers.get("content-range") || "").split("/")[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

/** Where admin notices go: the admins' sign-in emails (KIDSAFE_ADMIN_EMAIL overrides, comma-separated). */
export async function adminEmails(): Promise<string[]> {
  const set = (process.env.KIDSAFE_ADMIN_EMAIL || "").split(",").map((e) => e.trim()).filter(Boolean);
  if (set.length) return set;
  const admins = await rest<{ email: string | null }[]>("ff_admin_users?select=email").catch(() => []);
  return [...new Set(admins.map((a) => (a.email || "").toLowerCase()).filter(Boolean))];
}
