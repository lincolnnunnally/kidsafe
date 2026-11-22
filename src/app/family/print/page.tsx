"use client";

// Printable tag cards for a child's code: a wristband strip and a shoe/Croc card, at true size.
// For the trip this weekend, before an engraved tag exists: print, trim, laminate or tape over,
// and loop through a bracelet or shoelace. The child's name is never printed on the card.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { getSupabase } from "@/lib/supabase";
import { fetchFamily, fetchKidTags } from "@/lib/kidsafe-client";
import { KID_SITE_HOST, kidCodeDisplay, kidTagUrl } from "@/lib/kidsafe-shared";
import { Loading } from "@/components/ui";
import { KidTopBar } from "../../KidTopBar";

const DESIGNS = ["🦋", "🦖", "🚒", "🦄", "🚀", "⭐", "🌈", "⚽"];

function PrintCards() {
  const code = (useSearchParams().get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [state, setState] = useState<"loading" | "ok" | "missing" | "signin">("loading");
  const [phone, setPhone] = useState("");
  const [svg, setSvg] = useState("");
  const [design, setDesign] = useState(DESIGNS[0]);

  useEffect(() => {
    const supa = getSupabase();
    if (!supa) { setState("signin"); return; }
    supa.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) { setState("signin"); return; }
      const [tags, family] = await Promise.all([fetchKidTags(), fetchFamily(uid)]);
      if (!tags.some((t) => t.code === code)) { setState("missing"); return; }
      setPhone(family?.phone || "");
      setSvg(await QRCode.toString(kidTagUrl(code), { type: "svg", margin: 1, errorCorrectionLevel: "M" }));
      setState("ok");
    }).catch(() => setState("missing"));
  }, [code]);

  if (state === "loading") return <Loading label="Making your cards…" />;
  if (state === "signin") return <p className="mt16">Please <Link className="linkish" href="/family">sign in</Link> first.</p>;
  if (state === "missing") return <p className="mt16">We couldn&apos;t find that tag in your family. <Link className="linkish" href="/family">Back</Link></p>;
  const qr = <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />;
  return (
    <>
      <div className="no-print">
        <h1>Print {code}</h1>
        <p className="muted mt8">Print at 100% size (not &ldquo;fit to page&rdquo;). Cut on the outer line, fold on the dotted line so the picture
          is on the front and the QR code is on the back, then cover with clear tape or laminate. Loop it through a bracelet, shoelace or
          Croc hole. Scan the back once with your phone to check.</p>
        <div className="row wrap gap8 mt12" role="group" aria-label="Pick a picture">
          {DESIGNS.map((d) => (
            <button key={d} className={`chip ${d === design ? "on" : ""}`} style={{ fontSize: "1.3rem" }} onClick={() => setDesign(d)}>{d}</button>
          ))}
        </div>
        <button className="btn btn-primary mt12" onClick={() => window.print()}>🖨️ Print</button>
      </div>
      <div className="ks-print-sheet mt24">
        {/* Wristband strip: fold on the dotted line so the picture is the front and the QR is the back. */}
        <div className="ks-fold ks-fold-band">
          <div className="ks-card ks-card-face">
            <span style={{ fontSize: "30pt" }}>{design}</span>
            <div><b>LOST?</b><span>Show a grown-up in uniform.</span><span>Scan the back.</span></div>
          </div>
          <div className="ks-card ks-card-face">
            {qr}
            <div>
              <b>SCAN TO REACH MY GROWN-UP</b>
              {phone && <span>or call {phone}</span>}
              <span>No scan? Go to {KID_SITE_HOST}</span>
              <span className="ks-code">Code {kidCodeDisplay(code)}</span>
            </div>
          </div>
        </div>
        {/* Shoe or Croc card: fold on the dotted line, top over bottom. */}
        <div className="ks-fold ks-fold-shoe">
          <div className="ks-card ks-card-face">
            <span style={{ fontSize: "34pt" }}>{design}</span>
            <b>LOST? Scan the back.</b>
          </div>
          <div className="ks-card ks-card-face">
            {qr}
            <b>SCAN TO REACH MY GROWN-UP</b>
            {phone && <span>or call {phone}</span>}
            <span>No scan? Go to {KID_SITE_HOST}</span>
            <span className="ks-code">Code {kidCodeDisplay(code)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PrintPage() {
  return (
    <>
      <div className="no-print"><KidTopBar /></div>
      <main className="page">
        <Suspense fallback={<Loading />}><PrintCards /></Suspense>
      </main>
    </>
  );
}
