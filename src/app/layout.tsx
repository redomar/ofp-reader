import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { collapseBootScript } from "@/lib/collapse-boot";

const sans = IBM_Plex_Sans({ variable: "--f-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const cond = Barlow_Condensed({ variable: "--f-cond", subsets: ["latin"], weight: ["500", "600", "700"] });
const mono = IBM_Plex_Mono({ variable: "--f-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "OFP Reader",
  description: "Read a SimBrief operational flight plan as an interactive pilot chart. Runs entirely in your browser.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f3" },
    { media: "(prefers-color-scheme: dark)", color: "#121a27" },
  ],
};

const themeScript = `try{var t=localStorage.getItem("ofp-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${cond.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: collapseBootScript }} />
      </head>
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
