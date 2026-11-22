// kidsafe.unitedundergod.org/s/TOKEN: the page a parent sends to staff, security or police when a
// child is lost. An up-to-date photo, what they're wearing, where they were last seen, anything
// that keeps them safe, and one tap to call the parent. The link works only while the parent keeps
// sharing on (it ends on its own after at most a week; see ks_share_child).

import type { Metadata } from "next";
import { kidShareView } from "@/lib/kidsafe";
import { serviceReady } from "@/lib/tagserver";
import { grownUpName, telHref } from "@/lib/kidsafe-shared";
import { USER_IMG_ATTRS } from "@/lib/images";
import { KidTopBar } from "../../KidTopBar";
import { LocalTime } from "../../LocalTime";
import { ShareButtons } from "./ShareButtons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Help find a child",
  description: "A family shared this page so staff and police can help find their child.",
  robots: { index: false, follow: false },
  openGraph: { title: "Help find a child · Kid Safe", description: "A family shared this page so staff and police can help find their child.", siteName: "Kid Safe", type: "website" },
  twitter: { card: "summary", title: "Help find a child · Kid Safe", description: "A family shared this page so staff and police can help find their child." },
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let view: Awaited<ReturnType<typeof kidShareView>> | "down";
  try {
    view = token.toLowerCase() === "demo" || serviceReady() ? await kidShareView(token) : "down";
  } catch (e) {
    console.error("[kids/s]", e instanceof Error ? e.message : e);
    view = "down";
  }

  if (view === "down" || view.status !== "shared") {
    return (
      <>
        <KidTopBar right={<span />} />
        <div className="page page-narrow center">
          <div className="empty"><div className="big">🛡️</div>
            <h1>{view === "down" ? "We can't load this page right now" : "This page isn't shared anymore"}</h1>
          </div>
          <p className="muted">{view === "down" ? "Please try again in a minute." : "The family turned sharing off, or the link ended. Ask them to send it again."}</p>
        </div>
      </>
    );
  }

  const who = grownUpName(view.contactName);
  return (
    <>
      <KidTopBar right={<span />} />
      <div className="page page-narrow">
        {view.demo && <div className="notice mt8 no-print"><b>This is a sample.</b> It&apos;s what a family sends to staff or police.</div>}
        {view.missing ? (
          <div className="card ks-alarm mt8">
            <div style={{ fontWeight: 800, fontSize: "1.3rem" }}>🚨 MISSING CHILD</div>
            <div className="small mt4">
              {view.missingSince ? <>Since <b><LocalTime iso={view.missingSince} /></b>. </> : null}
              If you see {view.childName}, stay with them and call {who}.
            </div>
          </div>
        ) : (
          <div className="notice mt8">{who} shared {view.childName}&apos;s details so staff can help if they get separated.</div>
        )}

        <div className="center mt16">
          {view.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.photoUrl} alt={view.childName} {...USER_IMG_ATTRS} loading="eager" className="ks-photo ks-photo-lg" />
          ) : (
            <div style={{ fontSize: "5rem", lineHeight: 1 }}>🧒</div>
          )}
          {view.photoAt && <div className="tiny muted mt4">Photo added <LocalTime iso={view.photoAt} /></div>}
          <h1 className="mt12" style={{ fontSize: "2.2rem" }}>{view.childName}</h1>
          {view.age != null && <div className="muted">About {view.age} years old</div>}
        </div>

        <dl className="card ks-dl mt16">
          {view.lastSeen && <div><dt>Last seen</dt><dd>{view.lastSeen}</dd></div>}
          {view.wearing && (
            <div><dt>Wearing{view.wearingAt ? <> (as of <LocalTime iso={view.wearingAt} />)</> : null}</dt><dd>{view.wearing}</dd></div>
          )}
          {view.looks && <div><dt>What they look like</dt><dd>{view.looks}</dd></div>}
          {view.missingMessage && <div><dt>From {who}</dt><dd>&ldquo;{view.missingMessage}&rdquo;</dd></div>}
          {!view.lastSeen && !view.wearing && !view.looks && !view.missingMessage && (
            <div><dd className="muted">No description added yet.</dd></div>
          )}
        </dl>

        {view.needsNote && (
          <div className="card mt12" style={{ borderColor: "var(--gold)", borderWidth: 2 }}>
            <b>⚠️ Please know</b>
            <p className="mt4">{view.needsNote}</p>
          </div>
        )}

        {view.phone && (
          <a href={view.demo ? undefined : `tel:${telHref(view.phone)}`} className="btn btn-primary btn-block mt16" style={{ fontSize: "1.15rem", minHeight: 60 }}>
            📞 Call {who} · {view.phone}
          </a>
        )}
        {view.backup && (
          <a href={view.demo ? undefined : `tel:${telHref(view.backup.phone)}`} className="btn btn-soft btn-block mt8">
            📞 Or {view.backup.name || "the backup contact"} · {view.backup.phone}
          </a>
        )}
        {view.parentPhotoUrl && (
          <div className="card card-tight row gap12 mt12" style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={view.parentPhotoUrl} alt={`${who}, the child's grown-up`} {...USER_IMG_ATTRS}
              style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
            <div className="small"><b>{view.contactName}</b><div className="muted">{view.childName}&apos;s grown-up</div></div>
          </div>
        )}

        <ShareButtons title={`Help find ${view.childName}`} />

        <p className="tiny faint center mt24">
          If {view.childName} is in danger, call <a className="linkish" href="tel:911">911</a>.
          {view.expiresAt && <> This page stops working <LocalTime iso={view.expiresAt} />, or sooner if the family turns it off.</>}
        </p>
      </div>
    </>
  );
}
