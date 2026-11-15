"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useState } from "react";

export interface HeaderLabels {
  scenarios: Record<string, string>;
  contexts: Record<string, string>;
}

const VIEWS = [
  { href: "/", match: (p: string) => p === "/", label: "01 CARTE" },
  { href: "/scenario/s6/lune", match: (p: string) => p.startsWith("/scenario"), label: "02 SCÉNARIO" },
  { href: "/priorites/lune", match: (p: string) => p.startsWith("/priorites"), label: "03 PRIORITÉS" },
];

export default function Header({ labels }: { labels: HeaderLabels }) {
  const path = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("La question est traduite en scénario : l'outil ne répond jamais lui-même.");

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setNote("Aiguillage en cours…");
    try {
      const r = await fetch("/api/route-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      }).then((x) => x.json());
      const sc = labels.scenarios[r.scenario_id];
      const cx = labels.contexts[r.context_id];
      if (!sc || !cx) throw new Error("réponse invalide");
      setNote(
        `Traduit en « ${sc} » · ${cx}${r.pertinent ? "" : " (correspondance approximative)"} — aiguillage : ${r.via}.`,
      );
      router.push(`/scenario/${r.scenario_id}/${r.context_id}`);
    } catch {
      setNote("Aiguillage indisponible : choisissez un scénario dans la liste.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="top">
      <div className="wrap top-row">
        <Link className="brand" href="/">
          <span className="brand-dot" aria-hidden="true" />
          FLAME IN FREEFALL
        </Link>
        <form className="ask" role="search" onSubmit={ask}>
          <label htmlFor="q" className="eyebrow">
            Poser une question
          </label>
          <div className="ask-box">
            <input
              id="q"
              type="text"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ce tissu peut-il servir dans un habitat lunaire ?"
            />
            <button type="submit" disabled={busy}>
              {busy ? "…" : "Analyser"}
            </button>
          </div>
          <span className="ask-note" aria-live="polite">
            {note}
          </span>
        </form>
        <nav aria-label="Vues" className="views">
          {VIEWS.map((v) => {
            const on = v.match(path);
            return (
              <Link key={v.href} href={v.href} aria-current={on ? "page" : undefined} style={{ isolation: "isolate" }}>
                {on && <motion.span layoutId="nav-pill" className="pill" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                <span>{v.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
