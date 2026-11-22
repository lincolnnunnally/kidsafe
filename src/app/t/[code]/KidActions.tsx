"use client";

// The helper's buttons on a child's tag page: call, text, share where we are, send a note.
// Built for a security guard or staff member standing with a lost child: the call is first and
// biggest. Records the scan once the page loads in a browser (so the parent gets a text/email ping).
// The location and browser helpers are in lib/finder.ts.

import { useEffect, useRef, useState } from "react";
import { browserId, inAppBrowser, isIphone, locate, type Spot } from "@/lib/finder";
import { telHref } from "@/lib/kidsafe-shared";

type Sent = "idle" | "busy" | "done" | "error";

async function post(code: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/kids/tags/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, finder: browserId() }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && data.ok !== false, error: data.error };
  } catch {
    return { ok: false, error: "No connection. Please call the number instead." };
  }
}

const mapsLink = (s: Spot) => `https://maps.google.com/?q=${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;

export function KidActions({ code, who, phone, backup, childLabel, demo }: {
  code: string;
  /** "Sarah", or "this child's family" */
  who: string;
  phone: string | null;
  backup: { name: string | null; phone: string } | null;
  /** "Emma", or "your child" when the parent keeps the name private */
  childLabel: string;
  demo?: boolean;
}) {
  const recorded = useRef(false);
  const [demoNote, setDemoNote] = useState("");

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void post(code, { action: "scan" });
  }, [code]);

  const textBody = `Hi, I'm with ${childLabel}. I scanned their Kid Safe tag. We are at: `;

  return (
    <div className="stack gap12 mt16">
      {phone ? (
        demo ? (
          <>
            <button className="btn btn-primary btn-block" style={{ fontSize: "1.15rem", minHeight: 60 }}
              onClick={() => setDemoNote(`On a real tag this calls ${who} in one tap. ${who} also got a text the moment the tag was scanned.`)}>
              📞 Call {who} · {phone}
            </button>
            <button className="btn btn-soft btn-block" onClick={() => setDemoNote(`On a real tag this opens a text to ${who} that starts: "${textBody}"`)}>
              💬 Text {who}
            </button>
          </>
        ) : (
          <>
            <a href={`tel:${telHref(phone)}`} className="btn btn-primary btn-block" style={{ fontSize: "1.15rem", minHeight: 60 }}>
              📞 Call {who} · {phone}
            </a>
            <a href={`sms:${telHref(phone)}?&body=${encodeURIComponent(textBody)}`} className="btn btn-soft btn-block">
              💬 Text {who}
            </a>
          </>
        )
      ) : (
        <div className="notice notice-warm">
          This family hasn&apos;t added a phone number yet. Please stay with the child and take them to the
          lost-child point, guest services or security desk. Send the family a message below.
        </div>
      )}
      {demoNote && <div className="notice">{demoNote}</div>}

      <LocationCard code={code} who={who} phone={phone} childLabel={childLabel} demo={demo} />

      {backup && (
        <div className="card card-tight card-flat soft row spread wrap gap8">
          <div>
            <div className="tiny muted">If {who} doesn&apos;t answer</div>
            <div><b>{backup.name || "Backup contact"}</b><span className="small muted"> · {backup.phone}</span></div>
          </div>
          {demo ? (
            <button className="btn btn-soft btn-sm" onClick={() => setDemoNote(`On a real tag this calls ${backup.name || "the backup contact"}.`)}>📞 Call</button>
          ) : (
            <a className="btn btn-soft btn-sm" href={`tel:${telHref(backup.phone)}`}>📞 Call</a>
          )}
        </div>
      )}

      <MessageCard code={code} who={who} childLabel={childLabel} demo={demo} />
    </div>
  );
}

function MessageCard({ code, who, childLabel, demo }: { code: string; who: string; childLabel: string; demo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<Sent>("idle");
  const [err, setErr] = useState("");

  async function send() {
    setErr("");
    if (!note.trim()) { setErr("Write a short message first."); return; }
    setState("busy");
    if (demo) { setState("done"); return; }
    const r = await post(code, { action: "message", message: note.trim(), contact: contact.trim(), website });
    if (r.ok) setState("done");
    else { setState("error"); setErr(r.error || "That didn't send. Please call instead."); }
  }

  if (state === "done") return <div className="notice">Message sent to {who}. Thank you for staying with {childLabel}.</div>;
  return (
    <div className="card card-tight">
      {!open ? (
        <button className="btn btn-ghost btn-block" onClick={() => setOpen(true)}>Send {who} a message</button>
      ) : (
        <>
          <b>💌 Send {who} a message</b>
          <p className="small muted mt4">It goes straight to their phone and email. Say where you are and who you are.</p>
          <textarea className="mt8" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3}
            placeholder={`I'm with ${childLabel} at guest services by the main entrance…`} aria-label="Your message" />
          <input className="mt8" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120}
            placeholder="Your name and phone (optional)" aria-label="Your name and phone (optional)" />
          <input className="hp" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
          <button className="btn btn-primary btn-block mt8" onClick={send} disabled={state === "busy"}>
            {state === "busy" ? "Sending…" : "Send message"}
          </button>
          {err && <div className="notice notice-warm mt8">{err}</div>}
        </>
      )}
    </div>
  );
}

function LocationCard({ code, who, phone, childLabel, demo }: { code: string; who: string; phone: string | null; childLabel: string; demo?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "denied" | "failed">("idle");
  const [spot, setSpot] = useState<Spot | null>(null);
  const [typed, setTyped] = useState("");
  const [typedState, setTypedState] = useState<Sent>("idle");

  async function share() {
    if (demo) { setSpot({ lat: 28.4177, lng: -81.5812, accuracy: 12 }); setState("done"); return; }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) { setState("failed"); return; }
    setState("busy");
    try {
      const s = await locate();
      const r = await post(code, { action: "location", lat: s.lat, lng: s.lng, accuracy: Math.round(s.accuracy) });
      if (!r.ok) { setState("failed"); return; }
      setSpot(s);
      setState("done");
    } catch (e) {
      setState((e as GeolocationPositionError)?.code === 1 ? "denied" : "failed");
    }
  }

  async function sendTyped() {
    if (!typed.trim()) return;
    setTypedState("busy");
    if (demo) { setTypedState("done"); return; }
    const r = await post(code, { action: "message", message: `Where I am with ${childLabel}: ${typed.trim()}` });
    setTypedState(r.ok ? "done" : "error");
  }

  return (
    <div className="card" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
      <b style={{ fontSize: "1.05rem" }}>📍 Show {who} where you are</b>
      {state !== "done" ? (
        <>
          <p className="small mt4">Your phone will ask to share this spot. {who} gets a map pin so they can come straight to you.</p>
          <button className="btn btn-accent btn-block mt8" onClick={share} disabled={state === "busy"} style={{ fontSize: "1.05rem" }}>
            {state === "busy" ? "Finding your spot…" : "📍 Share my location"}
          </button>
          <p className="tiny muted mt4">Sent once, only to this family.</p>
        </>
      ) : (
        <>
          <div className="notice mt8">
            Sent. {who} has a map pin of where you are
            {spot && spot.accuracy ? ` (within about ${Math.max(5, Math.round(spot.accuracy / 5) * 5)} m)` : ""}.
          </div>
          {spot && phone && !demo && (
            <a className="btn btn-soft btn-block mt8"
              href={`sms:${telHref(phone)}?&body=${encodeURIComponent(`I'm with ${childLabel} here: ${mapsLink(spot)}`)}`}>
              💬 Text it to {who} too
            </a>
          )}
        </>
      )}
      {state === "denied" && (
        <div className="notice notice-warm mt8">
          <b>Location is off for this page.</b>{" "}
          {inAppBrowser()
            ? "This page opened inside another app. Open it in Safari or Chrome, then tap Share again."
            : isIphone()
              ? "On iPhone: Settings → Privacy & Security → Location Services → Safari Websites → While Using the App."
              : "Tap the icon left of the web address → Permissions → Location → Allow."}{" "}
          Or type where you are below.
        </div>
      )}
      {state === "failed" && <div className="notice notice-warm mt8">Your phone couldn&apos;t find this spot (this happens indoors). Type where you are below.</div>}
      {(state === "denied" || state === "failed") && (
        typedState === "done" ? <div className="notice mt8">Sent to {who}. Thank you!</div> : (
          <div className="mt8">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={300}
              placeholder="e.g. Guest services by the main gate" aria-label="Where you are" />
            <button className="btn btn-primary btn-block mt8" onClick={sendTyped} disabled={!typed.trim() || typedState === "busy"}>
              {typedState === "busy" ? "Sending…" : "Send where I am"}
            </button>
            {typedState === "error" && <div className="notice notice-warm mt8">That didn&apos;t send. Please call instead.</div>}
          </div>
        )
      )}
    </div>
  );
}
