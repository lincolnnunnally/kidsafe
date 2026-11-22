"use client";

// kidsafe.unitedundergod.org/reset: choose a new password, in Kid Safe's own name and look.
// The email link carries a one-time token (?token_hash=…&type=recovery, from /api/reset/request);
// an older-style link with tokens after the # also works.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { Loading } from "@/components/ui";
import { KidTopBar } from "../KidTopBar";

function ResetForm() {
  const supa = getSupabase();
  const router = useRouter();
  const search = useSearchParams();
  const [ready, setReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!supa) { setReady(true); return; }
    const tokenHash = search.get("token_hash");
    if (tokenHash) {
      supa.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => {
        if (error) setLinkFailed(true); else setSessionReady(true);
        window.history.replaceState({}, "", window.location.pathname);
        setReady(true);
      });
      return;
    }
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    if (access && refresh) {
      supa.auth.setSession({ access_token: access, refresh_token: refresh }).then(({ error }) => {
        if (error) setLinkFailed(true); else setSessionReady(true);
        window.history.replaceState({}, "", window.location.pathname);
        setReady(true);
      });
      return;
    }
    setReady(true);
  }, [supa, search]);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/reset/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, site: "kidsafe" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.message || "We couldn't send a reset email right now. Please try again in a few minutes."); return; }
      setSent(true);
    } catch {
      setErr("No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function choosePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supa) return;
    if (password.length < 8) { setErr("Please choose a password of at least 8 characters."); return; }
    setBusy(true); setErr("");
    try {
      const { error } = await supa.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/family");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "We couldn't save that. Request a new link below.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Loading label="One moment…" />;

  return (
    <>
      <h1 className="mt8">{sessionReady ? "Choose a new password" : "Forgot your password?"}</h1>
      <div className="notice notice-warm mt12">
        <b>If your child is missing right now,</b> tell the nearest staff member or security, or call{" "}
        <a className="linkish" href="tel:911">911</a>. Staff can reach you from your child&apos;s tag without you signing in.
      </div>
      {linkFailed && <div className="notice notice-warm mt12">That link has expired or was already used. Send yourself a new one below.</div>}
      <div className="card mt16">
        {sessionReady ? (
          <form onSubmit={choosePassword}>
            <div className="field mb16">
              <label>New password</label>
              <input type="password" autoComplete="new-password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            {err && <div className="notice notice-warm mb16">{err}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Saving…" : "Save and open my family"}</button>
          </form>
        ) : sent ? (
          <>
            <p>If <b>{email}</b> has a Kid Safe account, we just emailed a link to choose a new password. It works once and expires in about an hour.</p>
            <p className="tiny faint mt12">It comes from Kid Safe. Check spam if you don&apos;t see it in a minute.</p>
          </>
        ) : (
          <form onSubmit={requestLink}>
            <div className="field mb16">
              <label>Email</label>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            {err && <div className="notice notice-warm mb16">{err}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Sending…" : "Email me a reset link"}</button>
          </form>
        )}
      </div>
      <p className="mt16"><Link className="linkish" href="/family">Back to sign in</Link></p>
    </>
  );
}

export default function KidResetPage() {
  return (
    <>
      <KidTopBar right={<span />} />
      <main className="page page-narrow">
        <Suspense fallback={<Loading />}><ResetForm /></Suspense>
      </main>
    </>
  );
}
