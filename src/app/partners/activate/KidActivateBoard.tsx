"use client";

// The manager of a daycare, store or park scans the QR on a Kid Safe display we brought them and
// becomes a partner on the spot (FurFriend's ActivateBoard, in Kid Safe's name).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Field, Loading } from "@/components/ui";
import { usePartnerSession } from "@/components/usePartnerSession";
import { KidAuth } from "../../family/KidAuth";
import { KidTopBar } from "../../KidTopBar";
import { KID_PARTNER_KINDS } from "../kinds";

type Board = { board: string; activated: boolean; shop: string | null };

export function KidActivateBoard() {
  const code = (useSearchParams().get("board") || "").toUpperCase();
  const { ready, uid, email, toast, authed } = usePartnerSession();
  const [board, setBoard] = useState<Board | null>(null);
  const [boardErr, setBoardErr] = useState("");
  const [mine, setMine] = useState<{ name: string; status: string } | null | undefined>(undefined);
  const [f, setF] = useState({ name: "", kind: "daycare", contactName: "", email: "", phone: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    fetch(`/api/kids/partners/activate?board=${encodeURIComponent(code)}`).then((r) => r.json()).then((d) => {
      if (!d.ok) setBoardErr(d.error || "We don't know that display."); else setBoard(d);
    }).catch(() => setBoardErr("Couldn't look up this display. Check your connection and try again."));
  }, [code]);

  useEffect(() => {
    if (!uid) return;
    authed("/api/kids/partners/me").then((r) => r.json()).then((d) => {
      setMine(d.partner ? { name: d.partner.name, status: d.partner.status } : null);
      setF((x) => ({ ...x, email: x.email || d.email || email || "" }));
    }).catch(() => setMine(null));
  }, [uid, authed, email]);

  async function activate() {
    setErr("");
    if (!mine && f.name.trim().length < 2) { setErr("Add your business name."); return; }
    setBusy(true);
    try {
      const res = await authed("/api/kids/partners/activate", { method: "POST", body: JSON.stringify({ board: code, ...f }) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Couldn't activate the display.");
      setDone(d.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't activate the display.");
    } finally {
      setBusy(false);
    }
  }

  const page = (body: React.ReactNode) => (
    <>
      <KidTopBar right={<span className="small muted">Activate a display</span>} />
      <main className="page page-narrow">{body}</main>
      {toast && <div className={`toast ${toast.good ? "good" : ""}`}>{toast.msg}</div>}
    </>
  );

  if (boardErr) return page(<><div className="notice notice-warm mt16">{boardErr}</div><Link href="/" className="btn btn-primary mt12">About Kid Safe</Link></>);
  if (!board || !ready) return page(<Loading />);
  if (done) {
    return page(
      <div className="card mt16 center">
        <div style={{ fontSize: "3rem" }}>🎉</div>
        <h1>{done} is a Kid Safe partner!</h1>
        <p className="muted mt8">From the next scan, every family who sets up from this display is credited to you. Your dashboard has your link and a printable display.</p>
        <Link href="/partners/dashboard" className="btn btn-primary btn-block mt16">Open your dashboard</Link>
      </div>,
    );
  }
  if (board.activated) {
    return page(
      <div className="card mt16 center">
        <h1>This display is {board.shop ? `${board.shop}'s` : "already active"}</h1>
        <p className="muted mt8">Setting up your child? It&apos;s free and takes two minutes.</p>
        <Link href="/family" className="btn btn-primary btn-block mt16">Set up my family</Link>
      </div>,
    );
  }
  const intro = (
    <>
      <h1 className="mt16">Activate this Kid Safe display</h1>
      <p className="muted mt8">
        Display <b>{board.board}</b>. Set up your business in two minutes and you&apos;re live right away: families who scan it set up
        their children free, and your dashboard shows how many joined through you.
      </p>
      <p className="small muted mt8">Just a parent? <Link href="/family" className="linkish">Set up your family</Link>.</p>
    </>
  );
  if (!uid) return page(<>{intro}<p className="small muted mt16">First, a free account, so your dashboard is yours alone.</p><KidAuth audience="partner" /></>);
  if (mine === undefined) return page(<Loading />);
  if (mine) {
    return page(<>
      {intro}
      <div className="card mt16">
        <b>{mine.name}</b>
        <p className="small muted mt4">{mine.status === "paused" || mine.status === "declined" ? "This account's partnership is on hold. Email us and we'll sort it out." : `Connect display ${board.board} to ${mine.name}.`}</p>
        {err && <div className="notice notice-warm mt12">{err}</div>}
        {(mine.status === "approved" || mine.status === "applied") && (
          <button className="btn btn-primary btn-block mt12" onClick={activate} disabled={busy}>{busy ? "Connecting…" : `Connect this display to ${mine.name}`}</button>
        )}
      </div>
    </>);
  }
  return page(<>
    {intro}
    <div className="card mt16">
      <Field label="Business name"><input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Sunny Days Daycare" /></Field>
      <Field label="What kind of place">
        <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{KID_PARTNER_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
      <Field label="Your name"><input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} maxLength={80} /></Field>
      <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={200} /></Field>
      <Field label="Phone"><input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} /></Field>
      <Field label="Address"><input value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={200} /></Field>
      {err && <div className="notice notice-warm mb16">{err}</div>}
      <button className="btn btn-primary btn-block" onClick={activate} disabled={busy}>{busy ? "Activating…" : "Activate and become a partner"}</button>
    </div>
  </>);
}
