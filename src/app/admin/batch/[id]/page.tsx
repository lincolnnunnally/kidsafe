"use client";

// Printable blank tag cards for a batch: fold-over, picture on the front, QR on the back.
// No name and no phone: a parent scans and registers it to their child.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { Loading } from "@/components/ui";
import { usePartnerSession } from "@/components/usePartnerSession";
import { KID_SITE_HOST, kidCodeDisplay, kidTagUrl } from "@/lib/kidsafe-shared";
import { KidTopBar } from "../../../KidTopBar";

const DESIGNS = ["🦖", "🦋", "🚒", "🦄", "🚀", "⭐", "🌈", "⚽"];

export default function BatchPrint() {
  const { id } = useParams<{ id: string }>();
  const { ready, uid, authed } = usePartnerSession();
  const [cards, setCards] = useState<{ code: string; svg: string }[] | null>(null);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const r = await authed(`/api/kids/admin?batch=${id}`).then((x) => x.json()).catch(() => null);
      if (!r?.ok) { setErr(r?.error || "Couldn't load that batch."); return; }
      setTitle(`${r.batch.label || "Blank tags"}${r.batch.partner ? ` for ${r.batch.partner}` : ""}`);
      const open = (r.codes as { code: string; registered: boolean }[]).filter((c) => !c.registered);
      setCards(await Promise.all(open.map(async (c) => ({ code: c.code, svg: await QRCode.toString(kidTagUrl(c.code), { type: "svg", margin: 1, errorCorrectionLevel: "M" }) }))));
    })();
  }, [uid, id, authed]);

  if (!ready || (uid && !cards && !err)) return <Loading />;
  if (!uid || err) return <main className="page"><div className="notice notice-warm mt16">{err || "Sign in at the admin desk first."}</div></main>;
  return (
    <>
      <div className="no-print"><KidTopBar right={<span className="small muted">Admin</span>} /></div>
      <main className="page">
        <div className="no-print">
          <h1 className="mt8">{title}</h1>
          <p className="muted mt8">{cards!.length} cards not yet set up by a family. Print at 100%, cut on the outer line, fold on the dotted line (picture front, QR back), laminate.</p>
          <button className="btn btn-primary mt12" onClick={() => window.print()}>🖨️ Print</button>
        </div>
        <div className="ks-print-sheet mt24">
          {cards!.map((c, i) => (
            <div key={c.code} className="ks-fold ks-fold-band">
              <div className="ks-card ks-card-face">
                <span style={{ fontSize: "28pt" }}>{DESIGNS[i % DESIGNS.length]}</span>
                <div><b>LOST?</b><span>Show a grown-up in uniform.</span><span>Scan the back.</span></div>
              </div>
              <div className="ks-card ks-card-face">
                <div className="qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
                <div>
                  <b>SCAN TO REACH MY GROWN-UP</b>
                  <span>No scan? Go to {KID_SITE_HOST}</span>
                  <span className="ks-code">Code {kidCodeDisplay(c.code)}</span>
                  <span>New tag? Scan it to set it up.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
