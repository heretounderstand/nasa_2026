"use client";

// Parties animées de la vue Scénario : bande de contextes, flamme, explication.
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import Lumens from "./Lumens";

export interface StripItem {
  id: string;
  label: string;
  step: string;
  level: number | null; // null : référence
  aria: string;
}

export function ContextStrip({ sid, current, items }: { sid: string; current: string; items: StripItem[] }) {
  return (
    <div className="ctx-strip">
      {items.map((it) => (
        <Link key={it.id} href={`/scenario/${sid}/${it.id}`} aria-current={it.id === current ? "true" : undefined} aria-label={it.aria} scroll={false}>
          {it.id === current && <motion.span layoutId="ctx-bar" className="bar" transition={{ type: "spring", stiffness: 380, damping: 34 }} />}
          <span className="name">
            <b>{it.label}</b>
            <span>{it.step}</span>
          </span>
          {it.level == null ? <span className="small muted">certification</span> : <Lumens level={it.level} variant="wide" />}
        </Link>
      ))}
    </div>
  );
}

export function Flame({ ctx, caption }: { ctx: string; caption: string }) {
  const shape =
    ctx === "iss" || ctx === "gateway" ? (
      <div className="fl-micro" />
    ) : ctx === "earth" ? (
      <div className="fl-earth"><i /></div>
    ) : ctx === "moon" ? (
      <div className="fl-moon"><i /></div>
    ) : (
      <div className="fl-mars">?</div>
    );
  return (
    <aside className="side flame-box" aria-label="Flame behaviour">
      <div className="flame-stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={ctx}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {shape}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flame-cap">
        <span className="eyebrow">What the tests show</span>
        <span>{caption}</span>
      </div>
    </aside>
  );
}

/** Texte par règles affiché d'abord ; remplacé par la rédaction Gemini si elle passe les garde-fous. */
export function Explanation({ sid, cid, facts }: { sid: string; cid: string; facts: string[] }) {
  // La réponse est rangée avec la clé du cas demandé : si l'on change de cas,
  // l'ancienne réponse est ignorée sans réinitialiser l'état dans l'effet.
  const key = `${sid}/${cid}`;
  const [result, setResult] = useState<{ key: string; text: string | null; via: string } | null>(null);
  const ai = result?.key === key ? result : null;
  const [showFacts, setShowFacts] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario_id: sid, context_id: cid }),
    })
      .then((r) => r.json())
      .then((r) => alive && setResult({ key, text: r.text ?? null, via: r.via }))
      .catch(() => alive && setResult({ key, text: null, via: "rules" }));
    return () => {
      alive = false;
    };
  }, [sid, cid, key]);

  const useAi = Boolean(ai?.text);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={useAi ? "ai" : "rules"} className="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {useAi ? ai!.text : facts.join(" ")}
        </motion.p>
      </AnimatePresence>
      <div className="row" style={{ gap: 16, alignItems: "center" }}>
        <span className={`via ${useAi ? "ai" : ""}`}>
          <i />
          {ai == null
            ? "WRITING…"
            : useAi
              ? "WRITTEN BY GEMINI FROM THE ENGINE’S FACTS · NUMBERS CHECKED"
              : "RULE-BASED TEXT FROM THE ENGINE"}
        </span>
        {useAi && (
          <button type="button" className="linkish" onClick={() => setShowFacts((v) => !v)} aria-expanded={showFacts}>
            {showFacts ? "Hide the facts" : "Show the facts"}
          </button>
        )}
      </div>
      {useAi && showFacts && (
        <ul className="facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
