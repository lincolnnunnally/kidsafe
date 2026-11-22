"use client";

import { useState } from "react";

/** Pass the page on: the phone's share sheet, copy the link, or print it for a guard station. */
export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
    } catch { /* closed the sheet */ return; }
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { window.prompt("Copy this link:", url); }
  }
  return (
    <div className="row wrap gap8 mt16 no-print">
      <button className="btn btn-primary grow" onClick={share}>📤 Send this page</button>
      <button className="btn btn-soft" onClick={() => window.print()}>🖨️ Print</button>
      {copied && <div className="notice" style={{ width: "100%" }}>Link copied. Paste it in a text or email.</div>}
    </div>
  );
}
