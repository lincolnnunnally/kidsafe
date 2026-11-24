import type { Metadata } from "next";
import Link from "next/link";
import { KidTopBar } from "../KidTopBar";
import { formatGuideDate, listGuides } from "@/lib/guides";

// Guides for parents from the ecosystem's shared writing store (lpl_articles, app "kidsafe", see lib/guides.ts).
// New ones appear here as they are published. If the read fails, the page still renders with the way in.
export const revalidate = 600; // = GUIDES_REVALIDATE (Next needs a literal here)

const DESCRIPTION =
  "Plain guides for parents on keeping children safe at theme parks, zoos, festivals and field trips, and what to do if a child gets lost.";

export const metadata: Metadata = {
  title: "Guides for parents",
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  openGraph: { title: "Guides for parents · Kid Safe", description: DESCRIPTION, url: "/guides", siteName: "Kid Safe", type: "website" },
};

export default async function GuidesIndex() {
  const guides = await listGuides();
  return (
    <>
      <KidTopBar />
      <main className="page page-narrow">
        <div className="ks-kicker">For parents</div>
        <h1>Guides for parents</h1>
        <p className="muted mt4">Plain answers for days out with children: getting ready, staying together, and what to do if you get separated.</p>
        {guides.length ? (
          <div className="stack gap12 mt16">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="card">
                <h2>{g.title}</h2>
                {g.excerpt ? <p className="muted mt4">{g.excerpt}</p> : null}
                {g.publishedAt ? <p className="tiny faint mt4">{formatGuideDate(g.publishedAt)}</p> : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted mt16">New guides are on the way.</p>
        )}
        <section className="mt24 center">
          <Link href="/family" className="btn btn-primary">Set up my family, free</Link>
        </section>
        <p className="mt24"><Link className="linkish" href="/">Back to Kid Safe</Link></p>
      </main>
    </>
  );
}
