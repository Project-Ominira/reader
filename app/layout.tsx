import type { Metadata } from "next";
import { Source_Serif_4, Manrope, Literata } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${manrope.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
