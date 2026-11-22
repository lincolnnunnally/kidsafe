"use client";

// "Found a child? Type the code from their tag." For when the QR won't scan (scratched, wet, a phone
// that can't read it): the code printed under it opens the same page a scan does. No sign-in.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CodeLookup({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  function go(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{4,16}$/.test(clean)) { setErr("Type the letters and numbers printed on the tag, under the QR code."); return; }
    setErr("");
    router.push(`/t/${clean.toLowerCase()}`);
  }
  return (
    <form onSubmit={go} className={compact ? "" : "card mt12"} style={compact ? undefined : { borderColor: "var(--primary)", borderWidth: 2 }}>
      {!compact && <b>Found a child wearing a Kid Safe tag?</b>}
      {!compact && <p className="small muted mt4">If the QR code won&apos;t scan, type the code printed on the tag.</p>}
      <div className="row gap8 mt8">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ABC 1234" aria-label="Tag code"
          autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={24} style={{ flex: 1, fontSize: "1.1rem", letterSpacing: ".08em" }} />
        <button className="btn btn-primary">Find</button>
      </div>
      {err && <div className="notice notice-warm mt8">{err}</div>}
    </form>
  );
}
