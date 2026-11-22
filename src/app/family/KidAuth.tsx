"use client";

// Kid Safe sign-up / sign-in. The same shared United Under God account as FurFriend and the other
// apps (server signup through /api/signup, then a password sign-in), in Kid Safe's own words.

import { useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui";

/**
 * family: a parent making their family's account (default).
 * partner: a business making or opening its partner account.
 * admin: the owner's desk, sign-in only (admins already have accounts).
 */
export type KidAuthAudience = "family" | "partner" | "admin";

export function KidAuth({ audience = "family" }: { audience?: KidAuthAudience }) {
  const supa = getSupabase();
  const [mode, setMode] = useState<"up" | "in">(audience === "admin" ? "in" : "up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hp, setHp] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  if (!supa) return <div className="notice notice-warm mt16">Kid Safe isn&apos;t connected right now. Please try again shortly.</div>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supa) return;
    if (mode === "up" && !agree) {
      setErr(audience === "family" ? "Please confirm you're 18 or older and this child's parent or guardian." : "Please confirm you're 18 or older and agree to how Kid Safe handles information.");
      return;
    }
    setErr(""); setBusy(true);
    try {
      if (mode === "up") {
        const res = await fetch("/api/signup", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, hp, ack: agree }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.error) { setErr(data.error); return; }
      }
      const { error } = await supa.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    } catch (e2) {
      const m = e2 instanceof Error ? e2.message : "Something went wrong.";
      setErr(/invalid login/i.test(m) ? "That email or password doesn't match." : m);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setErr(""); setNote("");
    if (!email.includes("@")) { setErr("Enter your email above first, then tap Forgot password."); return; }
    const res = await fetch("/api/reset/request", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), site: "kidsafe" }),
    }).catch(() => null);
    if (!res || !res.ok) { setErr("We couldn't send a reset email right now."); return; }
    setNote("If that email has a Kid Safe account, we emailed a link to choose a new password. It comes from Kid Safe.");
  }

  return (
    <div className="card mt16">
      <h2>{audience === "admin" ? "Sign in to the partner desk"
        : audience === "partner" ? (mode === "up" ? "Make your business's Kid Safe account" : "Sign in to your partner account")
        : mode === "up" ? "Make your family's Kid Safe account" : "Sign in"}</h2>
      {audience === "admin" ? (
        <p className="small muted mt4 mb16">Use your United Under God admin account.</p>
      ) : (
        <div className="row gap8 mt12 mb16">
          <button type="button" className={`chip ${mode === "up" ? "on" : ""}`} onClick={() => setMode("up")}>I&apos;m new here</button>
          <button type="button" className={`chip ${mode === "in" ? "on" : ""}`} onClick={() => setMode("in")}>I have an account</button>
        </div>
      )}
      <form onSubmit={submit}>
        <div className="field mb16">
          <label>Email</label>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="field mb16">
          <label>Password</label>
          <input type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          {mode === "in" && <button type="button" className="linkish tiny mt8" style={{ alignSelf: "flex-end" }} onClick={forgot}>Forgot password?</button>}
        </div>
        <input className="hp" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden />
        {mode === "up" && (
          <Checkbox checked={agree} onChange={setAgree}>
            <span className="tiny muted">
              {audience === "family" ? <>I&apos;m 18 or older and the parent or guardian of the children I add. I&apos;ve read{" "}</>
                : <>I&apos;m 18 or older and sign up for this business. I&apos;ve read{" "}</>}
              <Link className="linkish" href="/privacy" onClick={(e) => e.stopPropagation()}>how Kid Safe handles our information</Link>.
            </span>
          </Checkbox>
        )}
        {err && <div className="notice notice-warm mb16">{err}</div>}
        {note && <div className="notice mb16">{note}</div>}
        <button className="btn btn-primary btn-block" disabled={busy || (mode === "up" && !agree)}>
          {busy ? "One moment…" : mode === "up" ? (audience === "partner" ? "Create the account" : "Create our account") : "Sign in"}
        </button>
      </form>
      {audience === "family" && <ul className="tiny muted mt12 ks-list">
        <li>🔒 A normal scan never shows your child&apos;s name or photo, or your address. Only your name, phone and their &ldquo;please know&rdquo; note.</li>
        <li>📤 Their full page is shared only when you choose, and it turns off when you say or after 3 days.</li>
        <li>🗑️ Delete a child or a tag any time. <Link className="linkish" href="/privacy">Everything we store</Link>.</li>
      </ul>}
      <p className="tiny faint center mt12">Already have an account with another United Under God app? Use the same email and password.</p>
    </div>
  );
}
