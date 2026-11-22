import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./kids.css";
import { Telemetry } from "@/lib/TelemetryProvider";

// Kid Safe: kidsafe.unitedundergod.org. Its own app, name and look (lincolnnunnally/kidsafe).
export const metadata: Metadata = {
  title: { default: "Kid Safe · QR tags that help a lost child find their family", template: "%s · Kid Safe" },
  description:
    "Fun QR tags for kids: bracelets, shoe tags and zipper pulls. If your child gets lost, a staff member scans the tag and calls you in one tap.",
  metadataBase: new URL("https://kidsafe.unitedundergod.org"),
  icons: { icon: { url: "/kidsafe-mark.svg", type: "image/svg+xml" } },
  openGraph: {
    title: "Kid Safe · QR tags that help a lost child find their family",
    description: "If your child gets lost, a staff member scans their tag and calls you in one tap.",
    siteName: "Kid Safe",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kid Safe · QR tags that help a lost child find their family",
    description: "If your child gets lost, a staff member scans their tag and calls you in one tap.",
  },
  appleWebApp: { title: "Kid Safe" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f4fa8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Poppins:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="ks">{children}</div>
        <Telemetry app="kidsafe" />
      </body>
    </html>
  );
}
