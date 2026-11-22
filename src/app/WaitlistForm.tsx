"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy"); setErr("");
    try {
      const res = await fetch("/api/kids/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) { setState("error"); setErr(data.error || "Please try again."); return; }
      setState("done");
    } catch {
      setState("error"); setErr("No connection. Please try again.");
    }
  }
  if (state === "done") return <div className="notice mt12">You&apos;re on the list. We&apos;ll email you once, when engraved tags are ready to order.</div>;
  return (
    <form onSubmit={submit} className="row wrap gap8 mt12">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
        aria-label="Your email" style={{ flex: "1 1 220px" }} />
      <input className="hp" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
      <button className="btn btn-soft" disabled={state === "busy"}>{state === "busy" ? "Adding…" : "Email me when tags are ready"}</button>
      {err && <div className="notice notice-warm" style={{ width: "100%" }}>{err}</div>}
    </form>
  );
}
