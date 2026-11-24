import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KidTopBar } from "../../KidTopBar";
import { SITE_ORIGIN, findGuide, formatGuideDate, renderGuideMarkdown } from "@/lib/guides";

// One published guide from the shared writing store (lpl_articles, app "kidsafe", see lib/guides.ts). Its
// address is https://kidsafe.unitedundergod.org/guides/<slug>, the address the Ideas app links to.
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return []; // built on first visit, then reused for `revalidate` seconds
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await findGuide(slug);
  if (!guide) return { title: "Guide not found", robots: { index: false, follow: false } };
  const path = `/guides/${guide.slug}`;
  const title = guide.seoTitle || guide.title;
  const description = guide.seoDescription || guide.excerpt || undefined;
  return {
    // `absolute`: the guide's own search title, without the site template.
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Kid Safe",
      type: "article",
      ...(guide.publishedAt ? { publishedTime: guide.publishedAt } : {}),
      ...(guide.updatedAt ? { modifiedTime: guide.updatedAt } : {}),
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = await findGuide(slug);
  if (!guide) notFound();
  const url = `${SITE_ORIGIN}/guides/${guide.slug}`;
  const description = guide.seoDescription || guide.excerpt;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        ...(description ? { description } : {}),
        url,
        mainEntityOfPage: url,
        ...(guide.publishedAt ? { datePublished: guide.publishedAt } : {}),
        ...(guide.updatedAt ? { dateModified: guide.updatedAt } : {}),
        ...(guide.tags.length ? { keywords: guide.tags.join(", ") } : {}),
        author: { "@type": "Organization", name: "Kid Safe" },
        publisher: { "@type": "Organization", name: "Kid Safe", logo: `${SITE_ORIGIN}/kidsafe-mark.svg` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Kid Safe", item: `${SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_ORIGIN}/guides` },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };
  return (
    <>
      <KidTopBar />
      <main className="page page-narrow">
        <script
          type="application/ld+json"
          // JSON.stringify output with "<" escaped, so no text in a guide can close this tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <div className="ks-kicker"><Link className="linkish" href="/guides">Guides</Link></div>
        <h1>{guide.title}</h1>
        {guide.publishedAt ? <p className="tiny faint mt4">{formatGuideDate(guide.publishedAt)}</p> : null}
        {guide.excerpt ? <p className="muted mt12" style={{ fontSize: "1.08rem" }}>{guide.excerpt}</p> : null}
        {/* Rendered with raw HTML disabled: any HTML in the source shows as text. */}
        <div className="ks-guide mt16" dangerouslySetInnerHTML={{ __html: renderGuideMarkdown(guide.bodyMd) }} />
        <section className="mt24 center">
          <Link href="/family" className="btn btn-primary">Set up my family, free</Link>
        </section>
        <p className="mt24"><Link className="linkish" href="/guides">All guides</Link></p>
      </main>
    </>
  );
}
