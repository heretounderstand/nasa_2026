import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import Header from "@/components/Header";
import { D } from "@/lib/data";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flame in Freefall",
  description:
    "What NASA's microgravity combustion data say about fire in space, how confident we can be, and which experiment is missing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Header
          labels={{
            scenarios: Object.fromEntries(D.scenarios.map((s) => [s.scenario_id, s.title])),
            contexts: Object.fromEntries(D.contexts.map((c) => [c.context_id, c.label])),
          }}
        />
        <main id="main" className="wrap">
          {children}
        </main>
        <footer className="wrap foot">
          <p>{D.disclaimer}</p>
          <p>
            Data: NASA Physical Sciences Informatics (psi.nasa.gov) and NTRS reports. Every value traces back to its file,
            row or page. <Link href="/sources">Sources</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
