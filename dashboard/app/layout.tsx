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
    "Ce que disent les données NASA de combustion en microgravité, avec quel niveau de confiance, et quelle expérience manque.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${archivo.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">
          Aller au contenu
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
            Données : NASA Physical Sciences Informatics (psi.nasa.gov) et rapports NTRS. Chaque valeur renvoie à son fichier,
            sa ligne ou sa page. <Link href="/sources">Sources</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
