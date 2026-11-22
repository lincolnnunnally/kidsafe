"use client";

// A Kid Safe partner's dashboard: their link and QR, the printable counter display, what families
// did with it, and their blank tags. Also where an invited business takes over (?claim=TOKEN),
// like FurFriend's /partners/dashboard.

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Loading } from "@/components/ui";
import { usePartnerSession } from "@/components/usePartnerSession";
import { KidAuth } from "../../family/KidAuth";
import { KidTopBar } from "../../KidTopBar";

type Me = {
  partner: null | {
    name: string; kindLabel: string; status: string; slug: string | null; link: string | null;
    contactName: string | null; phone: string | null; address: string | null; email: string;
    boardRequestedAt: string | null; boardSentAt: string | null;
  };
  stats: null | { families: number; blankTags: number; tagsRegistered: number; visits: number;
    batches: { id: string; label: string; quantity: number; registered: number; created_at: string }[] };
};

function Qr({ text }: { text: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => { QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg).catch(() => {}); }, [text]);
  return <div className="ks-qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR code for ${text}`} />;
}

export default function KidPartnerDashboard() {
  const { ready, uid, toast, flash, authed } = usePartnerSession();
  const [me, setMe] = useState<Me | null>(null);
  const [claimMsg, setClaimMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const token = new URLSearchParams(window.location.search).get("claim");
      if (token) {
        const r = await authed("/api/kids/partners/claim", { method: "POST", body: JSON.stringify({ token }) }).then((x) => x.json()).catch(() => null);
        setClaimMsg(r?.ok ? `Welcome! This is now ${r.name}'s dashboard.` : r?.error || "Couldn't open that invite.");
        window.history.replaceState({}, "", window.location.pathname);
      }
      const d = await authed("/api/kids/partners/me").then((x) => x.json()).catch(() => null);
      setMe(d?.ok ? d : { partner: null, stats: null });
    })();
  }, [uid, authed]);

  async function requestBoard() {
    setBusy(true);
    const r = await authed("/api/kids/partners/me", { method: "PATCH", body: JSON.stringify({ requestBoard: true, address }) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) { flash("Asked. We'll be in touch about your display.", true); setMe((m) => m && m.partner ? { ...m, partner: { ...m.partner, boardRequestedAt: new Date().toISOString() } } : m); }
    else flash(r?.error || "Couldn't send that. Please try again.");
  }

  const page = (body: React.ReactNode) => (
    <>
      <KidTopBar right={<Link href="/partners" className="btn btn-ghost btn-sm">For partners</Link>} />
      <main className="page page-narrow">{body}</main>
      {toast && <div className={`toast ${toast.good ? "good" : ""}`}>{toast.msg}</div>}
    </>
  );

  if (!ready) return page(<Loading />);
  if (!uid) return page(<><h1 className="mt8">Partner dashboard</h1><p className="muted mt8">Sign in to open your dashboard. Got an invite link? Sign in or make your account and it opens.</p><KidAuth audience="partner" /></>);
  if (!me) return page(<Loading label="Loading your dashboard…" />);
  const p = me.partner;
  if (!p) return page(<>{claimMsg && <div className="notice notice-warm mt8">{claimMsg}</div>}<h1 className="mt8">Not a partner yet</h1><p className="muted mt8">This account doesn&apos;t run a Kid Safe partner dashboard.</p><Link href="/partners#apply" className="btn btn-primary mt12">Apply to be a partner</Link></>);

  return page(
    <>
      {claimMsg && <div className="notice mt8">{claimMsg}</div>}
      <h1 className="mt8">{p.name}</h1>
      <p className="muted">{p.kindLabel} · {p.status === "approved" ? "Kid Safe partner" : p.status === "applied" ? "Application in review" : p.status === "paused" ? "Paused" : "Not approved"}</p>

      {p.status === "applied" && <div className="notice mt12">We&apos;ll email you when you&apos;re approved, usually within a day or two. If we bring you a display, scanning it approves you on the spot.</div>}

      {p.status === "approved" && p.link && p.slug && me.stats && (
        <>
          <div className="card mt16 row gap16 wrap" style={{ alignItems: "center" }}>
            <Qr text={p.link} />
            <div className="grow" style={{ minWidth: 220 }}>
              <b>Your link</b>
              <div className="small" style={{ wordBreak: "break-all" }}>{p.link}</div>
              <p className="small muted mt4">Families who scan it or open it get set up free, credited to you.</p>
              <div className="row wrap gap8 mt8">
                <Link href={`/partners/display/${p.slug}`} className="btn btn-primary btn-sm">🖨️ Print your counter display</Link>
                <button className="btn btn-soft btn-sm" onClick={() => navigator.clipboard?.writeText(p.link || "").then(() => flash("Link copied", true))}>Copy link</button>
              </div>
            </div>
          </div>

          <div className="ks-grid mt16">
            <div className="card center"><div style={{ fontSize: "2rem", fontWeight: 800 }}>{me.stats.families}</div><div className="small muted">families joined through you</div></div>
            <div className="card center"><div style={{ fontSize: "2rem", fontWeight: 800 }}>{me.stats.tagsRegistered}<span className="small muted"> / {me.stats.blankTags}</span></div><div className="small muted">of your tags set up by families</div></div>
            <div className="card center"><div style={{ fontSize: "2rem", fontWeight: 800 }}>{me.stats.visits}</div><div className="small muted">scans of your display and link</div></div>
          </div>

          {me.stats.batches.length > 0 && (
            <div className="card mt16">
              <b>Your tags to hand out</b>
              <ul className="small mt8 ks-list">
                {me.stats.batches.map((b) => <li key={b.id}>{b.label || "Tags"}: {b.registered} of {b.quantity} set up by families</li>)}
              </ul>
            </div>
          )}

          <div className="card mt16">
            <b>A display for your counter</b>
            {p.boardSentAt ? <p className="small muted mt4">Your display is on its way or with you. Scanning its QR credits you.</p>
              : p.boardRequestedAt ? <p className="small muted mt4">You asked for a display. We&apos;ll be in touch.</p>
              : (<>
                <p className="small muted mt4">Print the display above today, or ask us for a sturdier one with tags to hand out.</p>
                {!p.address && (
                  <input className="mt8" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200}
                    placeholder="Your address, so we can bring or send it" aria-label="Your address" autoComplete="street-address" />
                )}
                <button className="btn btn-soft btn-sm mt8" onClick={requestBoard} disabled={busy || (!p.address && address.trim().length < 8)}>Ask for a display</button>
              </>)}
          </div>
        </>
      )}
    </>,
  );
}
