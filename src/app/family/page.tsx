"use client";

// A parent's Kid Safe page: who to call, each child's profile, their tags, and the
// "my child is missing" button that turns on the alarm banner and makes a share page for staff or police.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { getSupabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/storage";
import { Checkbox, Field, Loading, Modal } from "@/components/ui";
import {
  addChild, claimKidTag, cleanKidCode, creditKidPartner, deleteChild, fetchChildren, fetchFamily, fetchKidScans, fetchKidTags, makeKidTag, removeKidTag, saveFamily,
  shareChild, stopSharing, updateChild, type ChildEdit, type KidChild, type KidFamily, type KidScan, type KidTag,
} from "@/lib/kidsafe-client";
import { ageFrom, kidShareUrl, kidTagUrl } from "@/lib/kidsafe-shared";
import { funnel } from "@/lib/telemetry";
import { KidTopBar } from "../KidTopBar";
import { LocalTime } from "../LocalTime";
import { KidAuth } from "./KidAuth";

type Flash = (m: string, good?: boolean) => void;

export default function FamilyPage() {
  const supa = getSupabase();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [toast, setToast] = useState<{ msg: string; good: boolean } | null>(null);
  const flash: Flash = useCallback((msg, good = false) => {
    setToast({ msg, good });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    if (!supa) { setUid(null); return; }
    supa.auth.getSession().then(({ data }) => setUid(data.session?.user.id || null));
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => setUid(session?.user.id || null));
    return () => sub.subscription.unsubscribe();
  }, [supa]);

  const signOut = supa && uid
    ? <button className="btn btn-ghost btn-sm" onClick={() => supa.auth.signOut()}>Sign out</button>
    : <span />;

  return (
    <>
      <KidTopBar right={signOut} />
      <main className="page page-narrow">
        {uid === undefined ? <Loading label="Opening Kid Safe…" /> : uid === null ? (
          <>
            <ClaimNotice />
            <h1 className="mt8">Set up your family</h1>
            <p className="muted mt8">Add each child once. Before a trip, update their photo and what they&apos;re wearing in a few seconds.</p>
            <KidAuth />
          </>
        ) : (
          <Dashboard uid={uid} flash={flash} />
        )}
      </main>
      {toast && <div className={`toast ${toast.good ? "good" : ""}`}>{toast.msg}</div>}
    </>
  );
}

function Dashboard({ uid, flash }: { uid: string; flash: Flash }) {
  const [family, setFamily] = useState<KidFamily | null>(null);
  const [children, setChildren] = useState<KidChild[]>([]);
  const [tags, setTags] = useState<KidTag[]>([]);
  const [scans, setScans] = useState<KidScan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [f, c, t, s] = await Promise.all([fetchFamily(uid), fetchChildren(), fetchKidTags(), fetchKidScans()]);
      setFamily(f); setChildren(c); setTags(t); setScans(s); setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load your family.");
    } finally {
      setLoaded(true);
    }
  }, [uid]);

  useEffect(() => { void reload(); }, [reload]);
  // Credit the partner whose display or link brought this family (attribution only; once).
  useEffect(() => { if (family) void creditKidPartner(); }, [family]);

  const setChild = (c: KidChild) => setChildren((all) => all.map((x) => (x.id === c.id ? c : x)));
  // A family is set up when its first child is saved: that is the sign-up that counts.
  const childAdded = (c: KidChild) => {
    if (!children.length) funnel.signupCompleted({ step: "first_child_added" });
    setChildren((all) => [...all, c]);
  };
  const missing = children.filter((c) => c.missing);

  if (!loaded) return <Loading label="Loading your family…" />;
  return (
    <>
      {err && <div className="notice notice-warm mt8">{err}</div>}
      {missing.map((c) => <MissingBanner key={c.id} child={c} onChange={setChild} flash={flash} />)}

      <ClaimTag uid={uid} kids={children} flash={flash}
        onClaimed={(t) => setTags((all) => [...all.filter((x) => x.code !== t.code), t])}
        onChildAdded={childAdded} />

      <h1 className="mt8">Your family</h1>
      {!family?.phone && (
        <div className="notice notice-warm mt8">Add your phone number first. It&apos;s the big Call button staff see when they scan a tag.</div>
      )}
      <FamilyCard uid={uid} family={family} onSaved={setFamily} flash={flash} />

      <div className="row spread mt24">
        <h2>Children</h2>
        {!adding && <button className="btn btn-soft btn-sm" onClick={() => setAdding(true)}>+ Add a child</button>}
      </div>
      {adding && <AddChild uid={uid} flash={flash} onDone={(c) => { setAdding(false); if (c) childAdded(c); }} />}
      {!children.length && !adding && (
        <div className="card mt12 center">
          <p>No children added yet.</p>
          <button className="btn btn-primary mt12" onClick={() => setAdding(true)}>Add your first child</button>
        </div>
      )}
      {children.map((c) => (
        <ChildCard key={c.id} uid={uid} child={c} tags={tags.filter((t) => t.child_id === c.id)} flash={flash}
          onChange={setChild}
          onTags={(next) => setTags((all) => [...all.filter((t) => t.child_id !== c.id), ...next])}
          onDeleted={() => { setChildren((all) => all.filter((x) => x.id !== c.id)); setTags((all) => all.filter((t) => t.child_id !== c.id)); }} />
      ))}

      <ScansCard scans={scans} kids={children} onRefresh={reload} />
    </>
  );
}

/* ------------------------------ contacts ------------------------------ */

function FamilyCard({ uid, family, onSaved, flash }: { uid: string; family: KidFamily | null; onSaved: (f: KidFamily) => void; flash: Flash }) {
  const [name, setName] = useState(family?.contact_name || "");
  const [phone, setPhone] = useState(family?.phone || "");
  const [backupName, setBackupName] = useState(family?.backup_name || "");
  const [backupPhone, setBackupPhone] = useState(family?.backup_phone || "");
  const [photo, setPhoto] = useState(family?.parent_photo_url || "");
  const [showPhoto, setShowPhoto] = useState(family?.show_parent_photo ?? true);
  const [texts, setTexts] = useState(family?.text_alerts ?? false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!family?.phone);

  async function save() {
    if (!phone.trim()) { flash("Add a phone number so staff can call you."); return; }
    setBusy(true);
    try {
      const f = await saveFamily(uid, {
        contact_name: name.trim() || null, phone: phone.trim(), backup_name: backupName.trim() || null,
        backup_phone: backupPhone.trim() || null, parent_photo_url: photo || null, show_parent_photo: showPhoto, text_alerts: texts,
      });
      onSaved(f); setOpen(false); flash("Saved", true);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try { setPhoto(await uploadImage(uid, file, "kid-parents")); } catch (e) { flash(e instanceof Error ? e.message : "Couldn't upload that photo."); }
  }

  if (!open) {
    return (
      <div className="card card-tight mt12 row spread wrap gap8">
        <div className="small">
          <b>Staff call {family?.contact_name || "you"}</b> at {family?.phone}
          {family?.backup_phone && <> · backup {family.backup_name || ""} {family.backup_phone}</>}
          <div className="tiny muted">{family?.text_alerts ? "📱 Text alerts on" : "Email alerts only"}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Edit</button>
      </div>
    );
  }
  return (
    <div className="card mt12">
      <b>Who staff should call</b>
      <div className="mt12">
        <Field label="Your first name (what staff call you)"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Sarah" /></Field>
        <Field label="Your cell phone"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="555-010-0123" /></Field>
        <Field label="Backup person (optional)" hint="Another adult on the trip, or a grandparent at home.">
          <div className="row gap8">
            <input value={backupName} onChange={(e) => setBackupName(e.target.value)} maxLength={60} placeholder="Name" />
            <input type="tel" value={backupPhone} onChange={(e) => setBackupPhone(e.target.value)} maxLength={30} placeholder="Phone" />
          </div>
        </Field>
        <Field label="Your photo (optional)" hint="So staff can check it's you who comes to pick your child up.">
          <div className="row gap12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo && <img src={photo} alt="You" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />}
            <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>
        </Field>
        {photo && <Checkbox checked={showPhoto} onChange={setShowPhoto}><span className="small">Show my photo when a tag is scanned</span></Checkbox>}
        <Checkbox checked={texts} onChange={setTexts}>
          <span className="small"><b>Text me the moment a tag is scanned.</b> <span className="muted">Only when a tag is scanned or someone sends a message. Reply STOP to end texts.</span></span>
        </Checkbox>
      </div>
      <div className="row gap8">
        <button className="btn btn-primary grow" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        {family?.phone && <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>}
      </div>
    </div>
  );
}

/* ------------------------------ children ------------------------------ */

function ChildFields({ uid, value, onChange, flash }: { uid: string; value: ChildEdit; onChange: (v: ChildEdit) => void; flash: Flash }) {
  const [uploading, setUploading] = useState(false);
  const set = (k: keyof ChildEdit, v: unknown) => onChange({ ...value, [k]: v });
  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try { set("photo_url", await uploadImage(uid, file, "kids")); } catch (e) { flash(e instanceof Error ? e.message : "Couldn't upload that photo."); }
    finally { setUploading(false); }
  }
  const thisYear = new Date().getFullYear();
  return (
    <>
      <Field label="First name"><input value={value.first_name || ""} onChange={(e) => set("first_name", e.target.value)} maxLength={40} /></Field>
      <Field label="Year born (optional)" hint="Staff see an age, not a birthday.">
        <input inputMode="numeric" value={value.birth_year ?? ""} maxLength={4} placeholder={String(thisYear - 6)}
          onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); set("birth_year", n >= 1990 && n <= thisYear ? n : null); }} />
      </Field>
      <Field label="A recent photo" hint="Take a new one the morning of a trip: same clothes, same hair.">
        <div className="row gap12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value.photo_url && <img src={value.photo_url} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover" }} />}
          <input type="file" accept="image/*" capture="environment" onChange={(e) => pick(e.target.files?.[0])} disabled={uploading} />
        </div>
      </Field>
      <Field label="What they look like"><input value={value.looks || ""} onChange={(e) => set("looks", e.target.value)} maxLength={200} placeholder="Brown hair in braids, glasses, about 4 feet tall" /></Field>
      <Field label="Wearing today"><input value={value.wearing || ""} onChange={(e) => set("wearing", e.target.value)} maxLength={200} placeholder="Yellow raincoat, purple leggings, pink sneakers" /></Field>
      <Field label="Anything staff must know" hint="Shown on every scan. Allergies, medicine, nonverbal, may run, scared of loud noises.">
        <textarea rows={2} value={value.needs_note || ""} onChange={(e) => set("needs_note", e.target.value)} maxLength={300} placeholder="Allergic to peanuts (EpiPen in backpack)" />
      </Field>
      <Checkbox checked={!!value.show_name} onChange={(v) => set("show_name", v)}>
        <span className="small">Show their first name when a tag is scanned <span className="muted">(off is safer; it shows anyway once you mark them missing)</span></span>
      </Checkbox>
      <Checkbox checked={!!value.show_photo} onChange={(v) => set("show_photo", v)}>
        <span className="small">Show their photo when a tag is scanned <span className="muted">(also shows once you mark them missing)</span></span>
      </Checkbox>
    </>
  );
}

function AddChild({ uid, flash, onDone }: { uid: string; flash: Flash; onDone: (c: KidChild | null) => void }) {
  const [v, setV] = useState<ChildEdit>({ show_name: false, show_photo: false });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!v.first_name?.trim()) { flash("Add their first name."); return; }
    setBusy(true);
    try {
      const c = await addChild(uid, { ...clean(v), first_name: v.first_name.trim() });
      flash(`${c.first_name} added`, true);
      onDone(c);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't add your child.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card mt12">
      <ChildFields uid={uid} value={v} onChange={setV} flash={flash} />
      <div className="row gap8">
        <button className="btn btn-primary grow" onClick={save} disabled={busy}>{busy ? "Adding…" : "Add child"}</button>
        <button className="btn btn-ghost" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </div>
  );
}

/** Empty text boxes are saved as "nothing", not as an empty string. */
function clean(v: ChildEdit): ChildEdit {
  const out: ChildEdit = { ...v };
  for (const k of ["looks", "wearing", "needs_note", "missing_message", "last_seen"] as const) {
    if (k in out) out[k] = (out[k] || "").trim() || null;
  }
  if (out.first_name) out.first_name = out.first_name.trim();
  return out;
}

function ChildCard({ uid, child, tags, flash, onChange, onTags, onDeleted }: {
  uid: string; child: KidChild; tags: KidTag[]; flash: Flash;
  onChange: (c: KidChild) => void; onTags: (t: KidTag[]) => void; onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState<ChildEdit>({});
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [wearing, setWearing] = useState(child.wearing || "");
  const age = ageFrom(child.birth_year);

  function startEdit() {
    setV({ first_name: child.first_name, birth_year: child.birth_year, photo_url: child.photo_url, looks: child.looks, wearing: child.wearing,
      needs_note: child.needs_note, show_name: child.show_name, show_photo: child.show_photo });
    setEditing(true);
  }

  async function save() {
    if (!v.first_name?.trim()) { flash("Add their first name."); return; }
    setBusy(true);
    try { const c = await updateChild(child.id, clean(v)); onChange(c); setWearing(c.wearing || ""); setEditing(false); flash("Saved", true); }
    catch (e) { flash(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }

  async function saveWearing() {
    try { const c = await updateChild(child.id, { wearing: wearing.trim() || null }); onChange(c); flash("Updated", true); }
    catch (e) { flash(e instanceof Error ? e.message : "Couldn't save."); }
  }

  async function remove() {
    if (!window.confirm(`Remove ${child.first_name} and their tags from Kid Safe? Tags already made will stop working.`)) return;
    try { await deleteChild(child.id); onDeleted(); flash("Removed", true); }
    catch (e) { flash(e instanceof Error ? e.message : "Couldn't remove."); }
  }

  if (editing) {
    return (
      <div className="card mt12">
        <ChildFields uid={uid} value={v} onChange={setV} flash={flash} />
        <div className="row gap8 wrap">
          <button className="btn btn-primary grow" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={remove}>Remove</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card mt12" style={child.missing ? { borderColor: "var(--alarm)", borderWidth: 2 } : undefined}>
      <div className="row gap12" style={{ alignItems: "flex-start" }}>
        {child.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={child.photo_url} alt={child.first_name} style={{ width: 76, height: 76, borderRadius: 18, objectFit: "cover", flex: "none" }} />
        ) : <div style={{ fontSize: "2.6rem", width: 76, textAlign: "center" }}>🧒</div>}
        <div className="grow">
          <div className="row spread wrap gap8">
            <h3>{child.first_name}{age != null && <span className="muted small"> · about {age}</span>}</h3>
            <button className="btn btn-ghost btn-sm" onClick={startEdit}>Edit</button>
          </div>
          {child.photo_at && <div className="tiny muted">Photo from <LocalTime iso={child.photo_at} /></div>}
          {child.needs_note && <div className="small mt4">⚠️ {child.needs_note}</div>}
        </div>
      </div>

      <div className="field mt12">
        <label className="small">Wearing today</label>
        <div className="row gap8">
          <input value={wearing} onChange={(e) => setWearing(e.target.value)} maxLength={200} placeholder="What are they wearing?" />
          {wearing !== (child.wearing || "") && <button className="btn btn-soft btn-sm" onClick={saveWearing}>Save</button>}
        </div>
      </div>

      {!child.missing && (
        <button className="btn btn-alarm btn-block mt12" onClick={() => setReporting(true)}>🚨 {child.first_name} is missing</button>
      )}
      <ShareRow child={child} onChange={onChange} flash={flash} />
      <TagsBlock child={child} tags={tags} onTags={onTags} flash={flash} />
      {reporting && <ReportMissing child={child} onClose={() => setReporting(false)} onDone={(c) => { onChange(c); setReporting(false); }} flash={flash} />}
    </div>
  );
}

/* --------------------------- missing + share --------------------------- */

function shareActive(c: KidChild): boolean {
  return !!c.share_token && !!c.share_expires_at && new Date(c.share_expires_at).getTime() > Date.now();
}

async function sendLink(url: string, title: string, flash: Flash) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
  } catch { return; }
  try { await navigator.clipboard.writeText(url); flash("Link copied. Paste it in a text or email.", true); }
  catch { window.prompt("Copy this link:", url); }
}

function ReportMissing({ child, onClose, onDone, flash }: { child: KidChild; onClose: () => void; onDone: (c: KidChild) => void; flash: Flash }) {
  const [lastSeen, setLastSeen] = useState(child.last_seen || "");
  const [wearing, setWearing] = useState(child.wearing || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await updateChild(child.id, clean({ missing: true, last_seen: lastSeen, wearing, missing_message: message }));
      await shareChild(child.id, 72);
      const fresh = (await fetchChildren()).find((c) => c.id === child.id);
      if (fresh) onDone(fresh);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't save. Call security now.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`${child.first_name} is missing`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-alarm" onClick={go} disabled={busy}>{busy ? "One moment…" : "Turn on the alarm"}</button></>}>
      <div className="notice notice-warm mb16"><b>First, tell the nearest staff member or security.</b> Call <a className="linkish" href="tel:911">911</a> if you think {child.first_name} is in danger.</div>
      <p className="small muted mb16">This puts a red &ldquo;family is looking&rdquo; banner on {child.first_name}&apos;s tag, shows their name and photo to whoever scans it, and makes a page you can send to staff and police.</p>
      <Field label="Where did you last see them?"><input value={lastSeen} onChange={(e) => setLastSeen(e.target.value)} maxLength={200} placeholder="By the carousel near the front gate" /></Field>
      <Field label="What are they wearing?"><input value={wearing} onChange={(e) => setWearing(e.target.value)} maxLength={200} /></Field>
      <Field label="A note for whoever finds them (optional)"><input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} placeholder="She knows to wait with someone in a uniform." /></Field>
    </Modal>
  );
}

function MissingBanner({ child, onChange, flash }: { child: KidChild; onChange: (c: KidChild) => void; flash: Flash }) {
  const [busy, setBusy] = useState(false);
  const url = child.share_token && shareActive(child) ? kidShareUrl(child.share_token) : null;
  async function found() {
    setBusy(true);
    try {
      await updateChild(child.id, { missing: false });
      await stopSharing(child.id);
      const fresh = (await fetchChildren()).find((c) => c.id === child.id);
      if (fresh) onChange(fresh);
      flash(`So glad ${child.first_name} is safe.`, true);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card ks-alarm mt8">
      <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>🚨 {child.first_name} is marked missing</div>
      <div className="small mt4">
        {child.missing_since && <>Since <LocalTime iso={child.missing_since} />. </>}
        Anyone who scans their tag sees a red banner and your number. Send this page to staff and police:
      </div>
      {url && (
        <div className="stack gap8 mt12">
          <button className="btn btn-block" style={{ background: "#fff", color: "#c0262d" }} onClick={() => sendLink(url, `Help find ${child.first_name}`, flash)}>
            📤 Send {child.first_name}&apos;s page
          </button>
          <a className="small" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", wordBreak: "break-all" }}>{url}</a>
        </div>
      )}
      <button className="btn btn-ghost btn-block mt12" style={{ borderColor: "#fff", color: "#fff" }} onClick={found} disabled={busy}>
        {busy ? "Saving…" : `✅ We found ${child.first_name}`}
      </button>
    </div>
  );
}

function ShareRow({ child, onChange, flash }: { child: KidChild; onChange: (c: KidChild) => void; flash: Flash }) {
  const [busy, setBusy] = useState(false);
  const active = shareActive(child);
  async function refresh() {
    const fresh = (await fetchChildren()).find((c) => c.id === child.id);
    if (fresh) onChange(fresh);
  }
  async function start() {
    setBusy(true);
    try {
      const token = await shareChild(child.id, 72);
      await refresh();
      await sendLink(kidShareUrl(token), `${child.first_name}'s Kid Safe page`, flash);
    } catch (e) { flash(e instanceof Error ? e.message : "Couldn't share."); }
    finally { setBusy(false); }
  }
  async function stop() {
    setBusy(true);
    try { await stopSharing(child.id); await refresh(); flash("Sharing off", true); }
    catch (e) { flash(e instanceof Error ? e.message : "Couldn't turn sharing off."); }
    finally { setBusy(false); }
  }
  if (child.missing) return null;
  return (
    <div className="card card-tight card-flat soft mt12">
      {active && child.share_token ? (
        <>
          <div className="small"><b>Sharing on</b> until <LocalTime iso={child.share_expires_at as string} />. Anyone with the link sees {child.first_name}&apos;s photo and description.</div>
          <div className="row gap8 wrap mt8">
            <button className="btn btn-soft btn-sm" onClick={() => sendLink(kidShareUrl(child.share_token as string), `${child.first_name}'s Kid Safe page`, flash)}>📤 Send link</button>
            <a className="btn btn-ghost btn-sm" href={kidShareUrl(child.share_token)} target="_blank" rel="noreferrer">Open</a>
            <button className="btn btn-ghost btn-sm" onClick={stop} disabled={busy}>Stop sharing</button>
          </div>
        </>
      ) : (
        <div className="row spread wrap gap8">
          <span className="small muted">Send {child.first_name}&apos;s page to a camp, school trip or security desk ahead of time.</span>
          <button className="btn btn-soft btn-sm" onClick={start} disabled={busy}>📤 Share page</button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- tags -------------------------------- */

function QrSvg({ url }: { url: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((s) => { if (live) setSvg(s); }).catch(() => {});
    return () => { live = false; };
  }, [url]);
  return <div className="ks-qr" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

const TAG_LABELS = ["Bracelet", "Shoe tag", "Zipper pull", "Backpack"];

function TagsBlock({ child, tags, onTags, flash }: { child: KidChild; tags: KidTag[]; onTags: (t: KidTag[]) => void; flash: Flash }) {
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(TAG_LABELS[0]);
  const [showQr, setShowQr] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    try { const t = await makeKidTag(child.id, label); onTags([...tags, t]); setShowQr(t.code); flash("Tag code made", true); }
    catch (e) { flash(e instanceof Error ? e.message : "Couldn't make a tag."); }
    finally { setBusy(false); }
  }
  async function remove(code: string) {
    if (!window.confirm("Remove this tag? Scanning it will stop reaching you.")) return;
    try { await removeKidTag(code); onTags(tags.filter((t) => t.code !== code)); }
    catch (e) { flash(e instanceof Error ? e.message : "Couldn't remove."); }
  }

  return (
    <div className="mt16">
      <b className="small">{child.first_name}&apos;s tags</b>
      {tags.map((t) => (
        <div key={t.code} className="card card-tight card-flat soft mt8">
          <div className="row spread wrap gap8">
            <div className="small"><b>{t.label || "Tag"}</b> · <span style={{ fontFamily: "monospace", letterSpacing: ".08em" }}>{t.code}</span></div>
            <div className="row gap8">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowQr(showQr === t.code ? null : t.code)}>{showQr === t.code ? "Hide QR" : "QR"}</button>
              <Link className="btn btn-soft btn-sm" href={`/family/print?code=${t.code}`}>🖨️ Print</Link>
              <button className="btn btn-danger btn-sm" onClick={() => remove(t.code)} aria-label="Remove tag">✕</button>
            </div>
          </div>
          {showQr === t.code && (
            <div className="row gap12 mt8 wrap">
              <QrSvg url={kidTagUrl(t.code)} />
              <div className="tiny muted" style={{ maxWidth: 260 }}>
                Opens <b>{kidTagUrl(t.code).replace("https://", "")}</b>. Scan it with your own phone to see exactly what staff see.
                (Your own scans show up below too.)
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="row gap8 mt8 wrap">
        <select value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Where it goes" style={{ maxWidth: 170 }}>
          {TAG_LABELS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <button className="btn btn-soft btn-sm" onClick={make} disabled={busy}>{busy ? "Making…" : "+ Make a tag code"}</button>
      </div>
    </div>
  );
}

/* -------------------------------- scans -------------------------------- */

function ScansCard({ scans, kids, onRefresh }: { scans: KidScan[]; kids: KidChild[]; onRefresh: () => void }) {
  const names = useMemo(() => new Map(kids.map((c) => [c.id, c.first_name])), [kids]);
  return (
    <div className="card mt24">
      <div className="row spread"><h2>Recent scans</h2><button className="btn btn-ghost btn-sm" onClick={onRefresh}>Refresh</button></div>
      {!scans.length ? <p className="small muted mt8">No one has scanned a tag yet.</p> : (
        <div className="stack gap8 mt12">
          {scans.map((s) => {
            const who = (s.child_id && names.get(s.child_id)) || "A tag";
            const map = s.lat != null && s.lng != null ? `https://www.google.com/maps?q=${s.lat},${s.lng}` : null;
            return (
              <div key={s.id} className="card card-tight card-flat soft small">
                <b>{s.kind === "location" ? `📍 ${who}: location shared` : s.kind === "message" ? `💬 Message about ${who}` : `🔔 ${who}'s tag scanned`}</b>
                <span className="muted"> · <LocalTime iso={s.created_at} />{s.city ? ` · near ${s.city}${s.region ? `, ${s.region}` : ""}` : ""}</span>
                {s.message && <div className="mt4">&ldquo;{s.message}&rdquo;</div>}
                {s.finder_contact && <div className="mt4">Reach them: {s.finder_contact}</div>}
                {map && <a className="linkish" href={map} target="_blank" rel="noreferrer">Open the map</a>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ blank tags ------------------------------ */

function claimFromUrl(): string {
  if (typeof window === "undefined") return "";
  return cleanKidCode(new URLSearchParams(window.location.search).get("claim") || "");
}

/** Before sign-in: "You're setting up tag ABC1234", so the parent knows why they're making an account. */
function ClaimNotice() {
  const [code, setCode] = useState("");
  useEffect(() => { setCode(claimFromUrl()); }, []);
  if (!code) return null;
  return (
    <div className="notice mt8">
      <b>You&apos;re setting up tag {code}.</b> Make your free account (or sign in), add your child, and the tag is theirs.
    </div>
  );
}

/**
 * Register a blank tag (picked up at a daycare, store, park or hotel) to a child: from the scan link
 * (?claim=CODE) or typed in. If there's no child yet, add one first.
 */
function ClaimTag({ uid, kids, flash, onClaimed, onChildAdded }: {
  uid: string; kids: KidChild[]; flash: Flash; onClaimed: (t: KidTag) => void; onChildAdded: (c: KidChild) => void;
}) {
  const [code, setCode] = useState("");
  const [fromLink, setFromLink] = useState(false);
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    const c = claimFromUrl();
    if (c) { setCode(c); setFromLink(true); setOpen(true); }
  }, []);
  useEffect(() => { if (!childId && kids.length === 1) setChildId(kids[0].id); }, [kids, childId]);

  async function claim() {
    const clean = cleanKidCode(code);
    if (!clean) { flash("Type the letters under the QR code on the back of the tag."); return; }
    if (!childId) { flash("Pick which child wears this tag."); return; }
    setBusy(true);
    try {
      const t = await claimKidTag(clean, childId);
      onClaimed(t);
      void creditKidPartner(clean);
      const name = kids.find((k) => k.id === childId)?.first_name || "your child";
      setDone(`Tag ${clean} is now ${name}'s. Scan it with your phone to see what a helper sees.`);
      if (fromLink) window.history.replaceState({}, "", window.location.pathname);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't set up that tag.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <div className="notice mt8">✅ {done}</div>;
  if (!open) {
    return (
      <p className="small mt8">
        <button className="linkish" onClick={() => setOpen(true)}>Got a tag from a daycare, store, park or hotel? Set it up</button>
      </p>
    );
  }
  return (
    <div className="card mt8" style={{ borderColor: "var(--primary)", borderWidth: 2 }}>
      <b>{fromLink ? `Set up tag ${code}` : "Set up a tag you picked up"}</b>
      {!fromLink && (
        <div className="field mt8">
          <label className="small">The letters under the QR code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={80} placeholder="e.g. K7M3QXA" autoCapitalize="characters" />
        </div>
      )}
      {kids.length ? (
        <div className="field mt8">
          <label className="small">Which child wears it?</label>
          <select value={childId} onChange={(e) => setChildId(e.target.value)}>
            <option value="">Choose…</option>
            {kids.map((k) => <option key={k.id} value={k.id}>{k.first_name}</option>)}
          </select>
          <button className="btn btn-primary btn-block mt8" onClick={claim} disabled={busy}>{busy ? "Setting up…" : "Make it theirs"}</button>
        </div>
      ) : (
        <>
          <p className="small muted mt4">First, add the child who will wear it.</p>
          <AddChild uid={uid} flash={flash} onDone={(c) => { if (c) { onChildAdded(c); setChildId(c.id); } }} />
        </>
      )}
      <p className="tiny muted mt8">Also add your phone number below: it&apos;s what a helper calls when they scan the tag.</p>
    </div>
  );
}
