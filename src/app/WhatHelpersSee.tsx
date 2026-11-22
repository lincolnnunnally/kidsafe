import Link from "next/link";

// The two states of a scan, spelled out the same way on the home page and the privacy page.
// Matches kidScanView in lib/kidsafe.ts: name and photo only by the parent's choice or once missing.
export function WhatHelpersSee({ compact = false }: { compact?: boolean }) {
  return (
    <div className="ks-grid-2 mt12">
      <div className="card">
        <h3>Every scan</h3>
        <p className="tiny muted mt4">The QR code is on the back of the tag, so a helper turns it over to scan.</p>
        <ul className="small mt8 ks-list">
          <li>✅ Your first name and a big <b>Call</b> button with your phone number</li>
          <li>✅ Your backup person, if you add one</li>
          <li>✅ Your child&apos;s &ldquo;please know&rdquo; note (allergies, nonverbal, may run)</li>
          <li>✅ Your photo, if you add it, so staff can check who picks them up</li>
          <li>✅ A button that sends you a map pin of where they are</li>
          <li>🚫 <b>Not</b> your child&apos;s name or photo (unless you turn that on)</li>
          <li>🚫 <b>Never</b> your home address</li>
        </ul>
        {!compact && <Link className="linkish small" href="/t/demohome">See an everyday scan</Link>}
      </div>
      <div className="card" style={{ borderColor: "var(--alarm)", borderWidth: 2 }}>
        <h3>After you tap &ldquo;missing&rdquo;</h3>
        <ul className="small mt8 ks-list">
          <li>🚨 A red &ldquo;this child&apos;s family is looking for them&rdquo; banner</li>
          <li>➕ Your child&apos;s first name and photo, so a helper can be sure</li>
          <li>➕ Your note, like &ldquo;we got separated by the carousel&rdquo;</li>
          <li>📤 A private page you can send to security or police: today&apos;s photo, what they&apos;re wearing, where you last saw them. It turns off when you tap &ldquo;We found them&rdquo;, or after 3 days.</li>
        </ul>
        {!compact && <Link className="linkish small" href="/t/demo">See a scan after &ldquo;missing&rdquo;</Link>}
      </div>
    </div>
  );
}
