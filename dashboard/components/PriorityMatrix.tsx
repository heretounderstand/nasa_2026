import Link from "next/link";

export interface Dot {
  sid: string;
  rank: number;
  short: string;
  knowledge: number; // 0..3
  risk: number; // 1..3
}

export default function PriorityMatrix({ dots, cid }: { dots: Dot[]; cid: string }) {
  const seen: Record<number, number> = {};
  return (
    <div className="matrix">
      <div className="q-dark" />
      <div className="q-lit" />
      <span className="lab" style={{ left: 20, top: 16, color: "var(--fire)" }}>
        BLIND SPOT · HIGH RISK, LITTLE KNOWLEDGE
      </span>
      <span className="lab" style={{ right: 20, bottom: 16, color: "var(--light)" }}>
        UNDER CONTROL
      </span>
      {dots.map((d, i) => {
        const k = seen[d.risk] ?? 0;
        seen[d.risk] = k + 1;
        const lit = d.knowledge >= 2;
        return (
          <Link
            key={`${cid}-${d.sid}`}
            href={`/scenario/${d.sid}/${cid}`}
            className="dot pop"
            style={{ left: `${8 + d.knowledge * 24}%`, top: `${(d.risk === 3 ? 14 : 62) + k * 10}%`, animationDelay: `${i * 0.07}s` }}
          >
            <i
              style={{
                background: lit ? "#CFE8FF" : "#FF7A2F",
                boxShadow: `0 0 14px ${lit ? "rgba(207,232,255,.6)" : "rgba(255,122,47,.6)"}`,
              }}
            />
            <span>
              {String(d.rank).padStart(2, "0")} · {d.short}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
