"use client";

import { useEffect } from "react";

export function Avatar({ emoji, size = "md" }: { emoji: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "avatar avatar-lg" : size === "sm" ? "avatar avatar-sm" : "avatar";
  return <span className={cls}>{emoji || "🐾"}</span>;
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  const full = Math.round(rating);
  return (
    <span className="row gap6" title={`${rating.toFixed(1)} out of 5`}>
      <span className="stars">{"★".repeat(full)}{"☆".repeat(5 - full)}</span>
      {count !== undefined && <span className="tiny faint">{count > 0 ? `${rating.toFixed(1)} (${count})` : "new"}</span>}
    </span>
  );
}

export function Empty({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="empty">
      <div className="big">{emoji}</div>
      <div style={{ fontWeight: 800, marginTop: 6 }}>{title}</div>
      {sub && <p className="small muted mt4">{sub}</p>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-full stack gap12" style={{ alignItems: "center" }}>
      <div className="spinner" />
      <span className="small muted">{label}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="xbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
        {footer && <div className="row gap8 mt16" style={{ justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="field mb16">
      <label>{label}</label>
      {children}
      {hint && <span className="tiny faint">{hint}</span>}
    </div>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="row gap8 mb16" style={{ cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="grow">{children}</span>
    </label>
  );
}

export function ChipRow<T extends string>({ options, value, onChange, multi }: {
  options: { code: T; label: string; emoji?: string }[];
  value: T[] | T;
  onChange: (v: T[] | T) => void;
  multi?: boolean;
}) {
  const selected = Array.isArray(value) ? value : [value];
  function toggle(code: T) {
    if (multi) {
      const set = new Set(selected);
      if (set.has(code)) set.delete(code); else set.add(code);
      onChange(Array.from(set) as T[]);
    } else {
      onChange(code);
    }
  }
  return (
    <div className="row wrap gap8">
      {options.map((o) => (
        <button key={o.code} type="button" className={`chip ${selected.includes(o.code) ? "on" : ""}`} onClick={() => toggle(o.code)}>
          {o.emoji && <span>{o.emoji}</span>}{o.label}
        </button>
      ))}
    </div>
  );
}

export function EmojiPick({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="row wrap gap8">
      {options.map((e) => (
        <button key={e} type="button" onClick={() => onChange(e)}
          className="chip static" style={{ fontSize: "1.3rem", padding: "6px 10px", ...(value === e ? { borderColor: "var(--primary)", background: "var(--primary-soft)" } : {}) }}>
          {e}
        </button>
      ))}
    </div>
  );
}
