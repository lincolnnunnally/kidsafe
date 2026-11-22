"use client";

// Kid Safe admin desk: partners (approve, pause, add one yourself and invite them), counter display
// codes to bring to a place, and batches of blank tags for a partner to hand out.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loading } from "@/components/ui";
import { usePartnerSession } from "@/components/usePartnerSession";
import { KidAuth } from "../family/KidAuth";
import { KidTopBar } from "../KidTopBar";
import { KID_PARTNER_KINDS } from "../partners/kinds";

type Partner = {
  id: string; name: string; kindLabel: string; status: string; email: string; contact_name: string | null; phone: string | null;
  address: string | null; interest: string; note: string | null; admin_note: string | null; created_at: string; link: string | null;
  board_requested_at: string | null; board_sent_at: string | null; hasAccount: boolean; inviteUrl: string | null;
  stats: null | { families: number; blankTags: number; tagsRegistered: number; visits: number };
};
type Board = { code: string; link: string; partner: string | null; note: string | null; activated_at: string | null; created_at: string };
type Batch = { id: string; label: string; quantity: number; partner: string | null; created_at: string };

export default function KidAdmin() {
  const { ready, uid, toast, flash, authed } = usePartnerSession();
  const [data, setData] = useState<{ partners: Partner[]; boards: Board[]; batches: Batch[] } | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await authed("/api/kids/admin").then((x) => x.json()).catch(() => null);
    if (!r?.ok) { setDenied(true); return; }
    setData(r);
  }, [authed]);
  useEffect(() => { if (uid) void load(); }, [uid, load]);

  async function act(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    const r = await authed("/api/kids/admin", { method: "POST", body: JSON.stringify(body) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r?.ok) { flash(r?.error || "That didn't save."); return null; }
    if (ok) flash(ok, true);
    await load();
    return r;
  }

  const page = (body: React.ReactNode) => (
    <><KidTopBar right={<span className="small muted">Admin</span>} /><main className="page">{body}</main>
      {toast && <div className={`toast ${toast.good ? "good" : ""}`}>{toast.msg}</div>}</>
  );
  if (!ready) return page(<Loading />);
  if (!uid) return page(<><h1 className="mt8">Kid Safe partner desk</h1><KidAuth audience="admin" /></>);
  if (denied) return page(<div className="notice notice-warm mt16">This desk is for Kid Safe admins.</div>);
  if (!data) return page(<Loading label="Loading the desk…" />);

  return page(
    <>
      <h1 className="mt8">Kid Safe partner desk</h1>

      <h2 className="mt24">Partners</h2>
      {!data.partners.length && <p className="small muted mt8">No partners yet. Add one below, or bring a display and let them scan it.</p>}
      {data.partners.map((p) => (
        <div key={p.id} className="card mt12">
          <div className="row spread wrap gap8">
            <div><b>{p.name}</b> <span className="small muted">· {p.kindLabel} · {p.status}</span></div>
            <div className="row wrap gap8">
              {p.status === "applied" && <><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act({ action: "approve", id: p.id }, "Approved")}>Approve</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "decline", id: p.id }, "Declined")}>Decline</button></>}
              {p.status === "approved" && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "pause", id: p.id }, "Paused")}>Pause</button>}
              {(p.status === "paused" || p.status === "declined") && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "resume", id: p.id }, "Active again")}>Make active</button>}
            </div>
          </div>
          <div className="small muted mt4">{[p.contact_name, p.email, p.phone, p.address].filter(Boolean).join(" · ")}</div>
          {p.note && <div className="small mt4">Their note: {p.note}</div>}
          {p.stats && <div className="small mt4">{p.stats.families} families · {p.stats.tagsRegistered}/{p.stats.blankTags} blank tags set up · {p.stats.visits} scans</div>}
          {p.link && <div className="small mt4">Link: <a className="linkish" href={p.link} target="_blank" rel="noreferrer">{p.link}</a></div>}
          {p.board_requested_at && !p.board_sent_at && (
            <div className="small mt4">📦 Asked for a display. <button className="linkish" onClick={() => act({ action: "boardSent", id: p.id }, "Marked sent")}>Mark it sent</button></div>
          )}
          {!p.hasAccount && (
            <div className="small mt4">
              No account yet.{p.inviteUrl && <> Invite link: <span style={{ wordBreak: "break-all" }}>{p.inviteUrl}</span></>}{" "}
              <button className="linkish" disabled={busy} onClick={() => act({ action: "invite", id: p.id }, "Invite emailed")}>Email the invite</button>
            </div>
          )}
        </div>
      ))}

      <AddPartner onAdd={(body) => act({ action: "create", ...body }, "Added. Their invite link is on their card.")} busy={busy} />

      <h2 className="mt32">Counter displays</h2>
      <p className="small muted mt4">Make a display code, print its sign, and bring it in. The manager scans it to become a partner on the spot.</p>
      <MakeBoard partners={data.partners} busy={busy} onMake={(note, partnerId) => act({ action: "board", note, partnerId }, "Display code made")} />
      {data.boards.map((b) => (
        <div key={b.code} className="card card-tight mt8 row spread wrap gap8">
          <div className="small"><b style={{ fontFamily: "monospace" }}>{b.code}</b> · {b.partner ? `active for ${b.partner}` : "not activated yet"}{b.note ? ` · ${b.note}` : ""}</div>
          <Link className="btn btn-soft btn-sm" href={`/admin/display/${b.code}`}>🖨️ Print sign</Link>
        </div>
      ))}

      <h2 className="mt32">Blank tags to hand out</h2>
      <p className="small muted mt4">No name and no phone on them. A parent scans one and registers it to their child; the partner gets the credit.</p>
      <MintBatch partners={data.partners} busy={busy} onMint={(quantity, label, partnerId) => act({ action: "mint", quantity, label, partnerId }, "Tags made")} />
      {data.batches.map((b) => (
        <div key={b.id} className="card card-tight mt8 row spread wrap gap8">
          <div className="small"><b>{b.label || "Blank tags"}</b> · {b.quantity} tags{b.partner ? ` · for ${b.partner}` : " · your own stock"}</div>
          <Link className="btn btn-soft btn-sm" href={`/admin/batch/${b.id}`}>🖨️ Print cards</Link>
        </div>
      ))}
    </>,
  );
}

function AddPartner({ onAdd, busy }: { onAdd: (b: Record<string, string>) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", kind: "daycare", email: "", contactName: "", phone: "", address: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  if (!open) return <button className="btn btn-soft mt12" onClick={() => setOpen(true)}>+ Add a partner yourself</button>;
  return (
    <div className="card mt12">
      <b>Add a partner yourself</b>
      <div className="ks-grid-2 mt8">
        <input placeholder="Business name" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
        <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{KID_PARTNER_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input placeholder="Their email" value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={200} />
        <input placeholder="Contact name" value={f.contactName} onChange={(e) => set("contactName", e.target.value)} maxLength={80} />
        <input placeholder="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} />
        <input placeholder="Address" value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={200} />
      </div>
      <div className="row gap8 mt8">
        <button className="btn btn-primary" disabled={busy} onClick={() => { onAdd(f); setOpen(false); }}>Add</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function MakeBoard({ partners, busy, onMake }: { partners: Partner[]; busy: boolean; onMake: (note: string, partnerId: string) => void }) {
  const [note, setNote] = useState("");
  const [pid, setPid] = useState("");
  return (
    <div className="row wrap gap8 mt8">
      <input placeholder="Note (where it's going)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} style={{ flex: "1 1 200px" }} />
      <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ maxWidth: 240 }}>
        <option value="">Not assigned (they scan to activate)</option>
        {partners.filter((p) => p.status === "approved").map((p) => <option key={p.id} value={p.id}>For {p.name}</option>)}
      </select>
      <button className="btn btn-primary" disabled={busy} onClick={() => { onMake(note, pid); setNote(""); }}>Make a display code</button>
    </div>
  );
}

function MintBatch({ partners, busy, onMint }: { partners: Partner[]; busy: boolean; onMint: (q: number, label: string, pid: string) => void }) {
  const [q, setQ] = useState("25");
  const [label, setLabel] = useState("");
  const [pid, setPid] = useState("");
  return (
    <div className="row wrap gap8 mt8">
      <input inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, ""))} style={{ width: 90 }} aria-label="How many" />
      <input placeholder="Label (e.g. Spring field trip)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} style={{ flex: "1 1 200px" }} />
      <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ maxWidth: 240 }}>
        <option value="">Your own stock</option>
        {partners.filter((p) => p.status === "approved").map((p) => <option key={p.id} value={p.id}>For {p.name}</option>)}
      </select>
      <button className="btn btn-primary" disabled={busy} onClick={() => onMint(Number(q), label, pid)}>Make blank tags</button>
    </div>
  );
}
