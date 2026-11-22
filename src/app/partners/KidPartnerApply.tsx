"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Field, Loading } from "@/components/ui";
import { usePartnerSession } from "@/components/usePartnerSession";
import { KidAuth } from "../family/KidAuth";
import { KID_PARTNER_KINDS } from "./kinds";

export function KidPartnerApply() {
  const { ready, uid, email, toast, flash, authed } = usePartnerSession();
  const [existing, setExisting] = useState<{ status: string; name: string } | null | undefined>(undefined);
  const [f, setF] = useState({ name: "", kind: "daycare", contactName: "", email: "", phone: "", address: "", website: "", interest: "both", note: "" });
  const [wantsBoard, setWantsBoard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!uid) return;
    authed("/api/kids/partners/me").then((r) => r.json()).then((d) => {
      setExisting(d.partner ? { status: d.partner.status, name: d.partner.name } : null);
      setF((x) => ({ ...x, email: x.email || d.email || email || "" }));
    }).catch(() => setExisting(null));
  }, [uid, authed, email]);

  async function submit() {
    setErr("");
    if (f.name.trim().length < 2) { setErr("Add your business name."); return; }
    setBusy(true);
    try {
      const res = await authed("/api/kids/partners/apply", { method: "POST", body: JSON.stringify({ ...f, wantsBoard: wantsBoard && f.interest !== "stock" }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Couldn't send your application.");
      setExisting({ status: "applied", name: f.name });
      flash("Application sent. We'll email you when you're approved.", true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send your application.");
    } finally {
      setBusy(false);
    }
  }

  const shell = (body: React.ReactNode) => <>{body}{toast && <div className={`toast ${toast.good ? "good" : ""}`}>{toast.msg}</div>}</>;
  if (!ready) return <Loading />;
  if (!uid) return shell(<><p className="small muted">First, a free account, so your dashboard is yours alone.</p><KidAuth audience="partner" /></>);
  if (existing === undefined) return <Loading />;
  if (existing) {
    return shell(
      <div className="card">
        <b>{existing.name}</b>
        <p className="small muted mt4">
          {existing.status === "applied" ? "Your application is in. We'll email you when you're approved, usually within a day or two."
            : existing.status === "approved" ? "You're a Kid Safe partner."
            : existing.status === "paused" ? "Your partnership is paused. Email us with any questions."
            : "We couldn't take this application. Email us with any questions."}
        </p>
        <Link href="/partners/dashboard" className="btn btn-primary mt12">Open your dashboard</Link>
      </div>,
    );
  }
  return shell(
    <div className="card">
      <div className="ks-grid-2">
        <Field label="Business name"><input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Sunny Days Daycare" /></Field>
        <Field label="What kind of place">
          <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{KID_PARTNER_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <Field label="Your name"><input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} maxLength={80} autoComplete="name" /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={200} autoComplete="email" /></Field>
        <Field label="Phone"><input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} autoComplete="tel" /></Field>
        <Field label="Website (optional)"><input value={f.website} onChange={(e) => set("website", e.target.value)} maxLength={200} /></Field>
      </div>
      <Field label="Address"><input value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={200} autoComplete="street-address" /></Field>
      <Field label="How would you like to work with us?">
        <select value={f.interest} onChange={(e) => set("interest", e.target.value)}>
          <option value="both">Both: a display, and tags to hand out</option>
          <option value="display">A counter display</option>
          <option value="stock">Tags to hand out</option>
        </select>
      </Field>
      {f.interest !== "stock" && (
        <label className="row gap8 mb16" style={{ alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={wantsBoard} onChange={(e) => setWantsBoard(e.target.checked)} style={{ width: "auto", marginTop: 4 }} />
          <span className="small"><b>Bring or send me a counter display</b> for the address above.</span>
        </label>
      )}
      <Field label="Anything else? (how many families you see, how you'd hand tags out)">
        <textarea value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={500} />
      </Field>
      {err && <div className="notice notice-warm mb16">{err}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Apply to be a partner"}</button>
    </div>,
  );
}
