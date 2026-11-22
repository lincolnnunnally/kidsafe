// kidsafe.unitedundergod.org: what Kid Safe is, and the way in for parents.
//
// Says only what is true today (2026-11-21): setup and printable cards are free and live; engraved
// tags are not on sale yet (waitlist); alerts are email (texts need a sending number). The pictures
// are design previews and illustrations, labelled as such, never presented as customers.

import Image from "next/image";
import Link from "next/link";
import { KidTopBar } from "./KidTopBar";
import { WaitlistForm } from "./WaitlistForm";
import { WhatHelpersSee } from "./WhatHelpersSee";
import { CodeLookup } from "./CodeLookup";

const TRIPS: [string, string][] = [
  ["Theme park or fair", "a wristband with a buckle"],
  ["Pool or beach", "a soft loop on the swimsuit strap"],
  ["Cold-weather trip", "a snap strap on the coat"],
  ["School or field trip", "the backpack zipper"],
  ["Everyday", "a clip on a bag or belt loop"],
];

export default function KidSafeHome() {
  return (
    <>
      <KidTopBar />
      <main className="page">
        {/* First thing on the page: a helper who typed our address off a tag whose QR wouldn't scan. */}
        <CodeLookup />
        <section className="ks-hero">
          <div>
            <div className="ks-kicker">For theme parks, zoos, festivals and field trips</div>
            <h1>If your child gets lost, one scan reaches you.</h1>
            <p className="muted" style={{ fontSize: "1.08rem" }}>
              Your child wears a fun tag on a wristband, coat or backpack. Whoever finds them, a security guard, a staff
              member or another parent, turns it over and scans the code on the back with their phone camera. No app. They get a big button to call you, and you
              get an email the moment it&apos;s scanned.
            </p>
            <div className="row wrap gap8 mt16">
              <Link href="/family" className="btn btn-primary">Set up my family, free</Link>
              <Link href="/t/demohome" className="btn btn-ghost">See what a helper sees</Link>
            </div>
            <p className="small muted mt12">
              Free today: add your children and print a tag card for a wristband or shoe.
              Engraved wooden tags aren&apos;t on sale yet. <a className="linkish" href="#tags">Get on the list</a>.
            </p>
          </div>
          <figure className="ks-figure">
            <Image src="/tag-front-back.webp" alt="Two wooden tags, each shown front and back: a dinosaur and a butterfly on the front; on the back, the QR code and the words Scan to reach my grown-up"
              width={1376} height={272} priority />
            <figcaption>Design previews: the picture on the front, the QR code on the back. Engraved tags are not on sale yet.</figcaption>
          </figure>
        </section>

        <section className="mt32">
          <h2>What a helper sees when they scan</h2>
          <p className="muted mt4">Two different things, depending on whether you&apos;ve marked your child missing.</p>
          <WhatHelpersSee />
        </section>

        <section className="ks-grid-2 mt24">
          <div className="card">
            <h3>Who scans it?</h3>
            <p className="small mt8">
              Anyone with a phone. The camera reads the code; there&apos;s nothing to download. Teach your child the plan:
              &ldquo;If you&apos;re lost, stop, find someone in a uniform, and show them your tag.&rdquo; If no staff are
              around, another parent can scan it too.
            </p>
          </div>
          <div className="card">
            <h3>How do I find out?</h3>
            <p className="small mt8">
              We email you the moment the tag is scanned, again if the helper shares their spot (with a map pin), and
              again if they send you a note. Text alerts are being set up and will come to the phone you add.
              The helper can also call or text you straight from the page.
            </p>
          </div>
        </section>

        <section className="mt32" id="tags">
          <h2>The tags</h2>
          <p className="muted mt4">
            Laser-engraved maple, about 1½ × 2 inches (40 × 50 mm): big enough to spot, too big to swallow. A fun picture
            on the front. The QR code and &ldquo;Scan to reach my grown-up&rdquo; are on the back, against your child, so no one
            can scan it from across the room. Your child&apos;s name is never on the tag.
          </p>
          <figure className="ks-figure mt12">
            <div className="ks-scroll">
              <Image src="/attachments.webp" alt="Ways to attach a tag: wristband, swimsuit loop, coat snap strap, backpack zipper pull, clip"
                width={1536} height={210} />
            </div>
            <figcaption>Attachment previews. On a phone, swipe to see all five.</figcaption>
          </figure>
          <div className="card mt12">
            <b>Pick the attachment for the trip</b>
            <ul className="small mt8 ks-list">
              {TRIPS.map(([trip, how]) => <li key={trip}><b>{trip}:</b> {how}</li>)}
            </ul>
            <p className="tiny muted mt8">Wear it chest-high on the outside layer, where a guard will see it, on a loop loose enough to turn over. Never on a cord around the neck.</p>
          </div>
          <figure className="ks-figure mt12">
            <Image src="/where-to-wear.webp" alt="Illustration: children wearing wooden tags on a backpack strap and a coat pocket at a zoo, a park, a theme park and on a hike"
              width={1200} height={800} />
            <figcaption>Illustration, not real families.</figcaption>
          </figure>
          <div className="card mt12">
            <b>Want an engraved tag?</b>
            <p className="small muted mt4">They aren&apos;t on sale yet. Leave your email and we&apos;ll tell you once, when they are.
              Until then, set up your family for free and print a card.</p>
            <WaitlistForm />
          </div>
        </section>

        <section className="card mt24">
          <h2>Made to keep kids safe</h2>
          <ul className="small mt8" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li><b>Your child&apos;s name stays off the tag and off a normal scan.</b> A stranger who reads a child&apos;s name can call them by it.</li>
            <li><b>Wear it on the wrist, coat or backpack,</b> never on a cord around the neck. For little ones under 3, clip it to a backpack or stroller.</li>
            <li><b>Your information is yours.</b> Delete a child or a tag any time. <Link className="linkish" href="/privacy">What we store and who sees it</Link>.</li>
          </ul>
        </section>

        <section className="mt24 center">
          <Link href="/family" className="btn btn-primary">Set up my family, free</Link>
          <p className="tiny faint mt24">
            <Link className="linkish" href="/privacy">How we handle your family&apos;s information</Link>
            {" · "}<Link className="linkish" href="/partners">For daycares, stores, parks and hotels</Link>
            <span> · A United Under God app</span>
          </p>
        </section>
      </main>
    </>
  );
}
