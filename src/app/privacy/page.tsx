import type { Metadata } from "next";
import Link from "next/link";
import { KidTopBar } from "../KidTopBar";
import { WhatHelpersSee } from "../WhatHelpersSee";

export const metadata: Metadata = { title: "Your family's information" };

// A plain description of what the Kid Safe code stores and shows (lib/kidsafe.ts, the ks_ tables).
export default function KidPrivacy() {
  return (
    <>
      <KidTopBar />
      <main className="page page-narrow">
        <h1>Your family&apos;s information</h1>
        <div className="stack gap12 mt16">
          <p><b>What you add.</b> Your contact name and phone numbers, and for each child: a first name, birth year, photo,
            a description, what they&apos;re wearing, and any needs or allergies. Only a parent or guardian (18 or older) makes an account.</p>
          <div><b>What someone who scans a tag sees.</b><WhatHelpersSee compact /></div>
          <p><b>The share page.</b> When you tap Share, we make a private link to your child&apos;s page with their photo and description.
            Anyone with the link can see it until you turn sharing off, tap &ldquo;We found them&rdquo;, or it ends on its own after 3 days.</p>
          <p><b>Scans.</b> When a tag is scanned we save the time and the rough town from the internet connection. An exact spot is saved
            only if the person scanning taps &ldquo;Share my location&rdquo;. You see these in your family page.</p>
          <p><b>Alerts.</b> We email the address you sign in with. Text alerts are being set up; once they are, and if you turn them on, we text the phone number you added.</p>
          <p><b>Photos.</b> Photos are stored under a long, random web address that is not listed anywhere.</p>
          <p><b>Removing things.</b> Delete a child or a tag from your family page at any time, and the scans go with it.</p>
        </div>
        <p className="mt24"><Link className="linkish" href="/">Back to Kid Safe</Link></p>
      </main>
    </>
  );
}
