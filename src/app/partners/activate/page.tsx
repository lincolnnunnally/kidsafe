import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { KidActivateBoard } from "./KidActivateBoard";

export const metadata: Metadata = { title: "Activate this display", robots: { index: false, follow: false } };

export default function Page() {
  return <Suspense fallback={<Loading />}><KidActivateBoard /></Suspense>;
}
