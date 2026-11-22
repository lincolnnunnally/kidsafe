// kidsafe.unitedundergod.org/t: someone typed the address from a tag without the code, or wants to type it.

import type { Metadata } from "next";
import { KidTopBar } from "../KidTopBar";
import { CodeLookup } from "../CodeLookup";

export const metadata: Metadata = { title: "Find a tag", robots: { index: false, follow: false } };

export default function FindTag() {
  return (
    <>
      <KidTopBar right={<span />} />
      <main className="page page-narrow">
        <h1 className="mt8">Type the code from the tag</h1>
        <p className="muted mt8">It&apos;s printed on the back of the tag, near the QR code.</p>
        <CodeLookup />
        <p className="small muted mt16">Helping a lost child? Please stay with them and take them to the lost-child point, guest services or security.
          If they are in danger, call <a className="linkish" href="tel:911">911</a>.</p>
      </main>
    </>
  );
}
