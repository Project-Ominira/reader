import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Manrope, Literata } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

// The wider reader font picker (app/fonts.ts) is defined but not loaded here
// right now — only Literata (the current single reading-font default) is
// applied, so the other 7 self-hosted fonts aren't paying for themselves in
// bundle weight while there's no UI exposing them. Re-adding the picker is
// just restoring this import, not rebuilding the font definitions.

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata-google",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ominira",
  description: "A reading and listening companion",
  applicationName: "Ominira",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ominira",
  },
  other: {
    // Next only emits the standardized `mobile-web-app-capable` tag; older
    // iOS Safari (pre-17.4) only honors this legacy Apple-prefixed one for
    // standalone (no-browser-chrome) launch from the home screen.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF6F0",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Some browser extensions (password managers, form-fill tools, etc.)
      // inject their own attributes onto <html> before React hydrates —
      // e.g. a stray data-qb-installed. That's an external DOM mutation,
      // not a real client/server mismatch in this app's own markup, so it's
      // suppressed here rather than chased as a bug (per React's own
      // hydration-mismatch guidance).
      suppressHydrationWarning
      className={`${sourceSerif.variable} ${manrope.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
