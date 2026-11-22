// kidsafe.unitedundergod.org/partners/display/SLUG: a printable counter display for a partner
// (like FurFriend's /partners/display/SLUG). Letter size; the QR opens the partner's link.

import type { Metadata } from "next";
import QRCode from "qrcode";
import { approvedKidPartner, kidPartnerLink } from "@/lib/kidpartners";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Counter display", robots: { index: false, follow: false } };

export default async function KidDisplay({ params }: { params: Promise<{ slug: string }> }) {
  const p = await approvedKidPartner((await params).slug).catch(() => null);
  if (!p?.slug) return <main className="page page-narrow"><h1 className="mt16">We couldn&apos;t find that partner</h1></main>;
  const link = kidPartnerLink(p.slug);
  const svg = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c2740", light: "#ffffff" } });
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="no-print row spread wrap gap8 mt8">
        <p className="small muted">Print on letter paper at 100%. Fold along the middle to stand it up, or put it in a sign holder.</p>
        <PrintButton />
      </div>
      <div className="card mt16 center" style={{ background: "#fff", color: "#1c2740", padding: "0.5in", border: "2px solid #1c2740" }}>
        <div style={{ fontSize: "2.4rem" }}>🦖 🦋 🚒 🦄 🚀</div>
        <h1 style={{ fontSize: "2.4rem", marginTop: 12, color: "#1c2740" }}>If your child gets lost, one scan reaches you.</h1>
        <p style={{ fontSize: "1.2rem", marginTop: 12 }}>Set up a free Kid Safe tag for each child: your phone, a recent photo, and anything a helper should know.</p>
        <div style={{ width: "2.6in", height: "2.6in", margin: "24px auto 0" }} dangerouslySetInnerHTML={{ __html: svg }} />
        <p style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: 12 }}>Scan to set up your family</p>
        <p style={{ marginTop: 6 }}>No name on the tag. Nothing to download.</p>
        <p style={{ marginTop: 18, fontSize: ".95rem" }}>Ask {p.name} for a tag to hand to your child.</p>
        <p style={{ marginTop: 4, fontSize: ".8rem" }}>{link.replace("https://", "")}</p>
      </div>
    </main>
  );
}
