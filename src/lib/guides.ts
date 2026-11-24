// Guides for parents, from the ecosystem's shared writing store: `public.lpl_articles` in the shared LPL
// Supabase, written by the Ideas app (life-produces-life-source-of-truth 18_ECOSYSTEM_PUBLISHING.md). Kid Safe
// only reads its own rows (app "kidsafe"), with the public anon key, through Supabase's REST endpoint; the
// policy lpl_articles_public_read lets anyone read published rows. Server-side only. No framework imports,
// so `node --test` can run src/lib/guides.test.ts against it.

import MarkdownIt from "markdown-it";

export const GUIDES_APP = "kidsafe";
export const SITE_ORIGIN = "https://kidsafe.unitedundergod.org";

/** How long a guide read may take before the page carries on without it. */
export const GUIDES_TIMEOUT_MS = 3500;
/** Seconds a guide page (and its read) is reused before it is built again. */
export const GUIDES_REVALIDATE = 600;

export type GuideSummary = { slug: string; title: string; excerpt: string; publishedAt: string };
export type Guide = GuideSummary & {
  bodyMd: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
};

const SUMMARY = "slug,title,excerpt,published_at,publish_at";
const FULL = `${SUMMARY},body_md,tags,seo_title,seo_description,updated_at`;

/**
 * "Now" for the publish-time rule, floored to the revalidate window so a read's address (and so its cache
 * entry) stays the same for that window. A guide may appear up to one window after its publish time.
 */
export function publishCutoff(now: Date = new Date()): string {
  const step = GUIDES_REVALIDATE * 1000;
  return new Date(Math.floor(now.getTime() / step) * step).toISOString();
}

/**
 * The public-row rule, as PostgREST filters: app = 'kidsafe' and status = 'published' and
 * coalesce(published_at, publish_at) <= now(). Stated here even though RLS also enforces "published".
 */
function publishedFilters(cutoff: string): string {
  return [
    `app=eq.${GUIDES_APP}`,
    "status=eq.published",
    // Inside or=(...) a value with ":" or "." must be double-quoted.
    `or=(published_at.lte."${cutoff}",and(published_at.is.null,publish_at.lte."${cutoff}"))`,
  ].join("&");
}

/** Newest first. */
export function guidesListPath(cutoff: string): string {
  return `lpl_articles?select=${SUMMARY}&${publishedFilters(cutoff)}&order=published_at.desc.nullslast,publish_at.desc&limit=500`;
}

export function guidePath(slug: string, cutoff: string): string {
  return `lpl_articles?select=${FULL}&${publishedFilters(cutoff)}&slug=eq.${encodeURIComponent(slug)}&limit=1`;
}

/** A guide address segment, or "" when it cannot be one (never reaches the database). */
export function cleanGuideSlug(slug: unknown): string {
  return typeof slug === "string" && /^[a-z0-9][a-z0-9-]{0,200}$/i.test(slug) ? slug : "";
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function toGuideSummary(r: Row): GuideSummary {
  return {
    slug: str(r.slug),
    title: str(r.title),
    excerpt: str(r.excerpt),
    publishedAt: str(r.published_at) || str(r.publish_at),
  };
}

export function toGuide(r: Row): Guide {
  return {
    ...toGuideSummary(r),
    bodyMd: str(r.body_md),
    tags: Array.isArray(r.tags) ? r.tags.map(str).filter(Boolean) : [],
    seoTitle: str(r.seo_title),
    seoDescription: str(r.seo_description),
    updatedAt: str(r.updated_at),
  };
}

type Fetch = (input: string, init?: RequestInit & { next?: { revalidate?: number } }) => Promise<Response>;
type ReadOptions = { fetch?: Fetch; url?: string; anonKey?: string; now?: Date };

/** Rows from the REST endpoint, or null when the read is not configured, fails or is too slow. */
async function readRows(path: string, opts: ReadOptions): Promise<Row[] | null> {
  const base = (opts.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = opts.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!base || !key) return null;
  const doFetch: Fetch = opts.fetch ?? fetch;
  try {
    const res = await doFetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(GUIDES_TIMEOUT_MS),
      next: { revalidate: GUIDES_REVALIDATE },
    });
    if (!res.ok) {
      console.error(`[guides] lpl_articles read failed: ${res.status}`);
      return null;
    }
    const rows = (await res.json()) as unknown;
    return Array.isArray(rows) ? (rows as Row[]) : null;
  } catch (err) {
    console.error("[guides] lpl_articles read failed:", err);
    return null;
  }
}

/** Published guides, newest first. None when the read fails: the page still renders. */
export async function listGuides(opts: ReadOptions = {}): Promise<GuideSummary[]> {
  const rows = await readRows(guidesListPath(publishCutoff(opts.now)), opts);
  return (rows ?? []).map(toGuideSummary).filter((g) => cleanGuideSlug(g.slug) && g.title);
}

/** One published guide, or null (unknown slug, or the read failed). */
export async function findGuide(slug: string, opts: ReadOptions = {}): Promise<Guide | null> {
  const clean = cleanGuideSlug(slug);
  if (!clean) return null;
  const rows = await readRows(guidePath(clean, publishCutoff(opts.now)), opts);
  const row = rows?.[0];
  return row ? toGuide(row) : null;
}

// Raw HTML in a guide is shown as text, never as markup (html: false). markdown-it also refuses
// javascript:, vbscript: and data: links (except images).
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

/** A guide body as HTML, with any HTML in the source escaped. */
export function renderGuideMarkdown(source: string): string {
  return md.render(source || "");
}

/** "November 5, 2026" from an ISO timestamp, in UTC so server and browser agree. */
export function formatGuideDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
