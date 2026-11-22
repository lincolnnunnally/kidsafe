// kidsafe.unitedundergod.org/partners: for places parents go. The same two ways as FurFriend's
// partner program (a counter display, and tags to hand out), then the application.
// Prices and a partner share aren't set yet, so this page names none.

import type { Metadata } from "next";
import Link from "next/link";
import { KidTopBar } from "../KidTopBar";
import { KidPartnerApply } from "./KidPartnerApply";

export const metadata: Metadata = {
  title: "Partner with Kid Safe",
  description: "Daycares, pediatric offices, kids' stores, sports facilities, amusement parks, cruise lines and hotels: help lost children get back to their families.",
  openGraph: { title: "Partner with Kid Safe", description: "Help lost children get back to their families, fast.", siteName: "Kid Safe", type: "website" },
};

const WAYS = [
  {
    ico: "🪧",
    title: "A small counter display",
    points: [
      "A display for your front desk or checkout with your own QR code.",
      "Parents scan it and set up their children in a couple of minutes, free: their phone number, a recent photo, and anything a helper should know.",
      "Your dashboard shows how many families joined through you.",
    ],
  },
  {
    ico: "🏷️",
    title: "Tags to hand out",
    points: [
      "Fun tags with a picture on the front and a QR code on the back. No name and no phone number on them, so any child can wear one.",
      "A parent scans the tag and registers it to their child on the spot. Nothing to fill in at your desk.",
      "Great for check-in, field trips, birthday parties, park entry and resort arrival.",
    ],
  },
];

const PLACES = ["Daycares and preschools", "Pediatric and dental offices", "Kids' clothing and toy stores", "Sports facilities", "Amusement parks", "Cruise lines", "Hotels and resorts", "Camps, schools and churches"];

export default function KidPartnersPage() {
  return (
    <>
      <KidTopBar right={<Link href="/partners/dashboard" className="btn btn-ghost btn-sm">Partner dashboard</Link>} />
      <main className="page">
        <div className="ks-kicker mt16">For places families go</div>
        <h1 className="mt8">Help lost children get back to their families, fast</h1>
        <p className="muted mt8" style={{ maxWidth: 680 }}>
          When a child is separated from their family at your place, your staff scan the child&apos;s tag and call the parent in one tap.
          Partner with Kid Safe to offer families the tags and the setup.
        </p>
        <div className="row wrap gap8 mt12">
          {PLACES.map((p) => <span key={p} className="chip static">{p}</span>)}
        </div>

        <div className="ks-grid-2 mt24">
          {WAYS.map((w) => (
            <div key={w.title} className="card">
              <div style={{ fontSize: "1.8rem" }} aria-hidden>{w.ico}</div>
              <h2 className="mt8">{w.title}</h2>
              <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.6, margin: "8px 0 0" }}>
                {w.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="card mt16">
          <h3>What your staff see</h3>
          <p className="small muted mt4">
            One big Call button, the child&apos;s &ldquo;please know&rdquo; note (allergies, nonverbal), and a button that sends the
            parent your exact spot. A normal scan never shows the child&apos;s name or photo.{" "}
            <Link href="/t/demohome" className="linkish">See a sample scan</Link>.
          </p>
          <p className="small muted mt8">Pricing for tags to hand out is set with each partner. Tell us what you have in mind below.</p>
        </div>

        <div id="apply" className="mt24" style={{ scrollMarginTop: 80 }}>
          <h2>Apply</h2>
          <KidPartnerApply />
        </div>
      </main>
    </>
  );
}
