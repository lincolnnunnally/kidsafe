"use client";

// "2:15 PM" today, or "Saturday 2:15 PM" for an earlier day, in the viewer's own time zone.
export function LocalTime({ iso }: { iso: string }) {
  let text = "";
  try {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    text = today ? `${time} today` : `${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}, ${time}`;
  } catch {
    text = iso.slice(0, 16).replace("T", " ");
  }
  return <span suppressHydrationWarning>{text}</span>;
}
