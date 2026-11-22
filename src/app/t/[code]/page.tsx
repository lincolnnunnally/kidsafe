// kidsafe.unitedundergod.org/t/CODE: what opens when a staff member or guard scans a child's tag.
//
// The person scanning is usually standing with a scared child at a theme park, bowling alley or
// festival. So: one big "Call" button first, then anything that keeps the child safe (allergies,
// "nonverbal"), then where-we-are. The child's name and photo show only if the parent chose to, or
// while the child is marked missing (see kidScanView in lib/kidsafe.ts). No account needed.

import type { Metadata } from "next";
import Link from "next/link";
import { kidScanView, type KidScanView } from "@/lib/kidsafe";
import { normalizeTagCode, serviceReady } from "@/lib/tagserver";
import { grownUpName } from "@/lib/kidsafe-shared";
import { USER_IMG_ATTRS } from "@/lib/images";
import { KidTopBar } from "../../KidTopBar";
import { LocalTime } from "../../LocalTime";
import { KidActions } from "./KidActions";
import { CodeLookup } from "../../CodeLookup";
import { headers } from "next/headers";
import { clientIp, hashKey } from "@/lib/ratelimit";
import { rest, restCount } from "@/lib/tagserver";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Helping a lost child",
  description: "This child wears a Kid Safe tag. Scan it to reach their family.",
  robots: { index: false, follow: false },
  openGraph: { title: "Helping a lost child · Kid Safe", description: "This child wears a Kid Safe tag. Open it to reach their family.", siteName: "Kid Safe", type: "website" },
  twitter: { card: "summary", title: "Helping a lost child · Kid Safe", description: "This child wears a Kid Safe tag. Open it to reach their family." },
};

function SafetySteps() {
  return (
    <div className="card card-tight card-flat soft mt16">
      <b>If no one answers</b>
      <ul className="small mt4" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
        <li>Please stay with the child. Don&apos;t leave them alone.</li>
        <li>Take them to the lost-child point, guest services or the security desk.</li>
        <li>If the child is hurt or in danger, call <a className="linkish" href="tel:911">911</a>.</li>
      </ul>
    </div>
  );
}

// Someone trying code after code: after 20 unknown codes in 10 minutes from one address
// (ks_lookup_misses, shared by every server instance), further UNKNOWN codes are slowed and answered
// "too many tries". A real code always opens at once: at a theme park or on a cruise ship hundreds of
// phones share one address, and a lost child must never wait on someone else's typos. The code space
// (31^7, about 27 billion) is what makes guessing impractical; this only makes walking it slower.
const MISS_LIMIT = 20;
const MISS_WINDOW_MS = 10 * 60 * 1000;

async function tooManyMisses(key: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - MISS_WINDOW_MS).toISOString();
    return (await restCount(`ks_lookup_misses?select=id&key=eq.${key}&created_at=gte.${encodeURIComponent(since)}`)) >= MISS_LIMIT;
  } catch {
    return false; // never lock a helper out because the counter is down
  }
}

async function recordMiss(key: string): Promise<void> {
  try {
    await rest("ks_lookup_misses", { method: "POST", body: JSON.stringify({ key }), prefer: "return=minimal" });
    if (Math.random() < 0.05) {
      const old = new Date(Date.now() - 864e5).toISOString();
      await rest(`ks_lookup_misses?created_at=lt.${encodeURIComponent(old)}`, { method: "DELETE", prefer: "return=minimal" });
    }
  } catch { /* a missed count never blocks a helper */ }
}

async function load(raw: string): Promise<KidScanView | "down" | "slow"> {
  const code = normalizeTagCode(raw);
  if (!code) return { status: "missing" };
  // Typed codes: someone trying code after code to find families. A real helper misses a few times at most.
  const ip = clientIp(new Request("http://x", { headers: await headers() }));
  const missKey = hashKey(`ks-miss:${ip}`);
  try {
    if (!serviceReady()) return code.startsWith("DEMO") ? await kidScanView(code) : "down";
    const view = await kidScanView(code);
    if (view.status !== "missing") return view;
    await recordMiss(missKey);
    if (await tooManyMisses(missKey)) {
      await new Promise((r) => setTimeout(r, 2000));
      return "slow";
    }
    return view;
  } catch (e) {
    console.error("[kids/t]", e instanceof Error ? e.message : e);
    return "down";
  }
}

export default async function KidTagPage({ params }: { params: Promise<{ code: string }> }) {
  const view = await load((await params).code);
  if (view === "slow") {
    return (
      <>
        <KidTopBar right={<span />} />
        <div className="page page-narrow center">
          <h1 className="mt16">We couldn&apos;t find that tag</h1>
          <p className="muted mt8">Many codes have been tried from this connection. Check the code on the tag and try again in a few minutes. If you&apos;re helping a lost child, stay with them and take them to the lost-child point,
            guest services or security. If they are in danger, call <a className="linkish" href="tel:911">911</a>.</p>
        </div>
      </>
    );
  }

  if (view !== "down" && view.status === "unlinked") {
    // A blank tag: maybe a helper with a lost child, maybe a parent who just picked it up.
    return (
      <>
        <KidTopBar right={<span />} />
        <div className="page page-narrow">
          <div className="card mt16">
            <b>Helping a lost child?</b>
            <p className="small mt4">This tag hasn&apos;t been set up by a family yet, so it can&apos;t reach anyone. Thank you for stopping.</p>
            <SafetySteps />
          </div>
          <div className="card mt16 center">
            <div style={{ fontSize: "3rem", lineHeight: 1 }}>🛡️</div>
            <h1 className="mt8" style={{ fontSize: "1.6rem" }}>{view.partnerName ? "Welcome to your child's new tag!" : "This tag is ready to set up"}</h1>
            <p className="muted mt8">
              {view.partnerName ? <>From <b>{view.partnerName}</b>. </> : null}
              Set it up in two minutes: your phone number, and your child&apos;s photo and anything a helper should know.
              Nothing is printed on the tag, so you can update it any time.
            </p>
            <Link href={`/family?claim=${view.code}`} className="btn btn-primary btn-block mt16">Set up this tag for my child</Link>
            <p className="tiny muted mt8">Free. Tag code {view.code}.</p>
          </div>
        </div>
      </>
    );
  }

  if (view === "down" || view.status !== "linked") {
    return (
      <>
        <KidTopBar right={<span />} />
        <div className="page page-narrow center">
          <div className="empty"><div className="big">🛡️</div>
            <h1>{view === "down" ? "We can't load this tag right now" : "We couldn't find that tag"}</h1>
          </div>
          {view !== "down" && <div style={{ textAlign: "left" }}><p className="small muted">Check the code on the tag and try again:</p><CodeLookup compact /></div>}
          <p>If you&apos;re helping a lost child, thank you. Please stay with them and take them to the lost-child point,
            guest services or security. If they are in danger, call <a className="linkish" href="tel:911">911</a>.</p>
        </div>
      </>
    );
  }

  const who = grownUpName(view.contactName);
  const childLabel = view.childName || "your child";
  const pronounLine = view.childName ? `${view.childName}${view.age ? `, about ${view.age},` : ""}` : `This child${view.age ? `, about ${view.age},` : ""}`;

  return (
    <>
      <KidTopBar right={<span />} />
      <div className="page page-narrow">
        {view.demo && (
          <div className="notice mt8">
            <b>{view.missing ? "Sample: after a parent taps \u201cmissing\u201d." : "Sample: an everyday scan."}</b>{" "}
            {view.missing ? "The child's name and photo now show, with a red banner." : "The child's name and photo stay hidden."}{" "}
            Try every button: nothing is sent to anyone.{" "}
            <Link className="linkish" href={view.missing ? "/t/demohome" : "/t/demo"}>{view.missing ? "See an everyday scan" : "See it after \u201cmissing\u201d"}</Link>
          </div>
        )}
        {view.missing && (
          <div className="card ks-alarm mt8">
            <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>🚨 This child&apos;s family is looking for them right now.</div>
            <div className="small mt4">
              {view.missingSince ? <>Missing since <b><LocalTime iso={view.missingSince} /></b>. </> : null}
              Please stay with them and call {who}.
            </div>
            {view.missingMessage && <p className="small mt8">&ldquo;{view.missingMessage}&rdquo;</p>}
          </div>
        )}

        <div className="center mt16">
          {view.childPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.childPhotoUrl} alt={view.childName || "The child"} {...USER_IMG_ATTRS} loading="eager" className="ks-photo" />
          ) : (
            <div style={{ fontSize: "4.2rem", lineHeight: 1 }}>🛡️</div>
          )}
          <h1 className="mt12" style={{ fontSize: "1.8rem" }}>Thank you for helping.</h1>
          <p className="mt8" style={{ fontSize: "1.08rem" }}>
            {pronounLine} is wearing a Kid Safe tag. Please stay with them and call {who}.
          </p>
        </div>

        {view.needsNote && (
          <div className="card mt16" style={{ borderColor: "var(--gold)", borderWidth: 2 }}>
            <b>⚠️ Please know</b>
            <p className="mt4">{view.needsNote}</p>
          </div>
        )}

        <KidActions code={view.code} who={who} phone={view.phone} backup={view.backup} childLabel={childLabel} demo={view.demo} />

        {view.parentPhotoUrl && (
          <div className="card card-tight row gap12 mt16" style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={view.parentPhotoUrl} alt={`${who}, the child's grown-up`} {...USER_IMG_ATTRS}
              style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--line-strong)", flex: "none" }} />
            <div className="small">
              <b>{view.contactName || "The child's grown-up"}</b>
              <div className="muted">Check that this is who comes to pick them up.</div>
            </div>
          </div>
        )}

        <SafetySteps />

        <p className="tiny faint center mt24">
          Opening this page lets the family know the tag was scanned and roughly which town you&apos;re in.
          Your exact spot is shared only if you tap the button above.
        </p>
      </div>
    </>
  );
}
