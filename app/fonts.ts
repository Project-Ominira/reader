import {
  Atkinson_Hyperlegible,
  Inter,
  Jost,
  Spectral,
  Newsreader,
  Bitter,
} from "next/font/google";
import localFont from "next/font/local";

// Reader font picker (stores/reader-store.ts FontFamily) — one definition
// per option, all loaded/self-hosted at build time via next/font so nothing
// round-trips to Google at request time. "System default" isn't here: it's a
// literal OS font-stack string, not a next/font loader (see
// FONT_FAMILY_VARS in reader-store.ts).
//
// Avenir, Lyon, Signifier, and Valkyrie are commercial typefaces with no
// free web-font license available — per product decision, each is
// substituted with a free lookalike in the same classification rather than
// licensed or omitted: Jost (Avenir, geometric-humanist sans), Spectral
// (Lyon, warm oldstyle-humanist serif), Newsreader (Signifier, restrained
// high-contrast book serif), Bitter (Valkyrie, sturdy literary slab-serif).
// The UI labels these transparently (e.g. "Avenir-style") rather than
// passing them off as the licensed originals.

// Atkinson Hyperlegible has no variable-weight build — request the two
// weights the reader chrome actually renders (400 body, 700 headings).
export const atkinsonHyperlegible = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

// Spectral has no variable-weight build either.
export const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const bitter = Bitter({
  variable: "--font-bitter",
  subsets: ["latin"],
});

// OpenDyslexic isn't distributed via Google Fonts — self-hosted here from
// the OFL-licensed font files in app/fonts/opendyslexic/ (see OFL.txt
// alongside them for the license).
export const openDyslexic = localFont({
  variable: "--font-opendyslexic",
  src: [
    { path: "./fonts/opendyslexic/OpenDyslexic-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/opendyslexic/OpenDyslexic-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/opendyslexic/OpenDyslexic-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/opendyslexic/OpenDyslexic-BoldItalic.woff2", weight: "700", style: "italic" },
  ],
});

export const readerFontVariables = [
  atkinsonHyperlegible.variable,
  inter.variable,
  jost.variable,
  spectral.variable,
  newsreader.variable,
  bitter.variable,
  openDyslexic.variable,
].join(" ");
