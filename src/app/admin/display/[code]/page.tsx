"use client";

// A printable sign for a Kid Safe counter display code. Its QR (kidsafe…/b/CODE) lets the manager
// activate the display on the spot, and after that sends parents to set up their families.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { KID_TAG_BASE } from "@/lib/kidsafe-shared";

export default function DisplaySign() {
  const { code } = useParams<{ code: string }>();
  const clean = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const link = `${KID_TAG_BASE}/b/${clean.toLowerCase()}`;
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c2740", light: "#ffffff" } }).then(setSvg).catch(() => {});
  }, [link]);
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="no-print row spread wrap gap8 mt8">
        <p className="small muted">Display {clean}. Print on letter paper at 100% and put it in a sign holder.</p>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print</button>
      </div>
      <div className="card mt16 center" style={{ background: "#fff", color: "#1c2740", padding: "0.5in", border: "2px solid #1c2740" }}>
        <div style={{ fontSize: "2.4rem" }}>🦖 🦋 🚒 🦄 🚀</div>
        <h1 style={{ fontSize: "2.4rem", marginTop: 12, color: "#1c2740" }}>If your child gets lost, one scan reaches you.</h1>
        <p style={{ fontSize: "1.2rem", marginTop: 12 }}>Set up a free Kid Safe tag for each child: your phone, a recent photo, and anything a helper should know.</p>
        <div style={{ width: "2.6in", height: "2.6in", margin: "24px auto 0" }} dangerouslySetInnerHTML={{ __html: svg }} />
        <p style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: 12 }}>Scan to set up your family</p>
        <p style={{ marginTop: 6 }}>No name on the tag. Nothing to download.</p>
        <p style={{ marginTop: 18, fontSize: ".85rem" }}>Business owner? Scan to activate this display for your business. · {clean}</p>
      </div>
    </main>
  );
}
