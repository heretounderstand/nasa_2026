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
  { href: "/", match: (p: string) => p === "/", label: "01 MAP" },
  { href: "/scenario/s6/moon", match: (p: string) => p.startsWith("/scenario"), label: "02 SCENARIO" },
  { href: "/priorities/moon", match: (p: string) => p.startsWith("/priorities"), label: "03 PRIORITIES" },
  { href: "/investigations", match: (p: string) => p.startsWith("/investigations"), label: "04 INVESTIGATIONS" },
];

export default function Header({ labels }: { labels: HeaderLabels }) {
  const path = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("Your question is matched to a scenario: the tool never answers it itself.");

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setNote("Routing…");
    try {
      const r = await fetch("/api/route-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      }).then((x) => x.json());
      const sc = labels.scenarios[r.scenario_id];
      const cx = labels.contexts[r.context_id];
      if (!sc || !cx) throw new Error("invalid response");
      setNote(
        `Matched to “${sc}” · ${cx}${r.relevant ? "" : " (approximate match)"}. Routed by ${r.via}.`,
      );
      router.push(`/scenario/${r.scenario_id}/${r.context_id}`);
    } catch {
      setNote("Routing unavailable: pick a scenario from the list.");
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
            Ask a question
          </label>
          <div className="ask-box">
            <input
              id="q"
              type="text"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Can this fabric be used in a lunar habitat?"
            />
            <button type="submit" disabled={busy}>
              {busy ? "…" : "Analyse"}
            </button>
          </div>
          <span className="ask-note" aria-live="polite">
            {note}
          </span>
        </form>
        <nav aria-label="Views" className="views">
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
