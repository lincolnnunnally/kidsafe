import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUIDES_APP,
  cleanGuideSlug,
  findGuide,
  formatGuideDate,
  guidePath,
  guidesListPath,
  listGuides,
  publishCutoff,
  renderGuideMarkdown,
  toGuide,
} from "./guides.ts";

const NOW = new Date("2026-11-24T10:07:30Z");
const OPTS = { url: "https://example.supabase.co/", anonKey: "anon-test", now: NOW };

function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { fn, calls };
}

describe("guides: the query", () => {
  it("reads only Kid Safe's published rows whose time has come", () => {
    assert.equal(GUIDES_APP, "kidsafe");
    const cutoff = publishCutoff(NOW);
    assert.equal(cutoff, "2026-11-24T10:00:00.000Z");
    const list = guidesListPath(cutoff);
    assert.match(list, /app=eq\.kidsafe/);
    assert.match(list, /status=eq\.published/);
    assert.match(list, /or=\(published_at\.lte\."2026-11-24T10:00:00\.000Z",and\(published_at\.is\.null,publish_at\.lte\."2026-11-24T10:00:00\.000Z"\)\)/);
    assert.match(list, /order=published_at\.desc\.nullslast/);
    assert.match(guidePath("lost-at-the-fair", cutoff), /&slug=eq\.lost-at-the-fair&limit=1$/);
  });

  it("refuses slugs that cannot be a guide address", () => {
    assert.equal(cleanGuideSlug("lost-at-the-fair"), "lost-at-the-fair");
    for (const bad of ["", "-x", "a/b", "a b", "x&app=eq.uug", 42, null]) assert.equal(cleanGuideSlug(bad), "");
  });
});

describe("guides: reading with a fake fetch", () => {
  it("lists guides with the anon key and the REST endpoint", async () => {
    const { fn, calls } = fakeFetch([
      { slug: "lost-at-the-fair", title: "Lost at the fair", excerpt: null, published_at: "2026-11-20T12:00:00Z" },
      { slug: "bad slug", title: "Dropped" },
    ]);
    const guides = await listGuides({ ...OPTS, fetch: fn });
    assert.deepEqual(guides, [{ slug: "lost-at-the-fair", title: "Lost at the fair", excerpt: "", publishedAt: "2026-11-20T12:00:00Z" }]);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith("https://example.supabase.co/rest/v1/lpl_articles?"));
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.apikey, "anon-test");
    assert.equal(headers.Authorization, "Bearer anon-test");
  });

  it("gives no guides, not an error, when the read fails or is not configured", async () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await listGuides({ ...OPTS, fetch: fakeFetch({ message: "down" }, 500).fn }), []);
      assert.deepEqual(await listGuides({ ...OPTS, fetch: async () => { throw new Error("timeout"); } }), []);
      assert.equal(await findGuide("x", { ...OPTS, fetch: async () => { throw new Error("timeout"); } }), null);
    } finally {
      console.error = quiet;
    }
    assert.deepEqual(await listGuides({ url: "", anonKey: "", fetch: fakeFetch([]).fn }), []);
  });

  it("finds one guide, and nothing for an unknown or bad slug", async () => {
    const row = { slug: "a", title: "A", body_md: "Hi", tags: ["parks", null], seo_title: "", seo_description: "d", published_at: "2026-11-20T12:00:00Z" };
    const g = await findGuide("a", { ...OPTS, fetch: fakeFetch([row]).fn });
    assert.equal(g?.bodyMd, "Hi");
    assert.deepEqual(g?.tags, ["parks"]);
    assert.equal(await findGuide("a", { ...OPTS, fetch: fakeFetch([]).fn }), null);
    const { fn, calls } = fakeFetch([row]);
    assert.equal(await findGuide("../x", { ...OPTS, fetch: fn }), null);
    assert.equal(calls.length, 0);
    assert.equal(toGuide({}).updatedAt, "");
  });
});

describe("guides: rendering a body", () => {
  it("renders Markdown and never passes raw HTML or script links through", () => {
    const html = renderGuideMarkdown("## Before you go\n\n**Take a photo** of what they wear.\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))");
    assert.match(html, /<h2>Before you go<\/h2>/);
    assert.match(html, /<strong>Take a photo<\/strong>/);
    assert.doesNotMatch(html, /<script|href="javascript:/i);
    assert.match(html, /&lt;script&gt;/);
  });

  it("dates read in UTC", () => {
    assert.equal(formatGuideDate("2026-11-05T02:00:00Z"), "November 5, 2026");
    assert.equal(formatGuideDate(""), "");
  });
});
