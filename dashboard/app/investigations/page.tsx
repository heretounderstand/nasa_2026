import Link from "next/link";
import { D, scenarioById } from "@/lib/data";

const STATUS: Record<string, { label: string; cls: string }> = {
  scenario: { label: "FEEDS A SCENARIO", cls: "lit" },
  notes: { label: "QUOTED, NOT CLASSIFIED", cls: "lit" },
  map: { label: "ON THE MAP ONLY", cls: "dim" },
  not_used: { label: "NOT USED", cls: "dark" },
};

export default function InvestigationsPage() {
  const items = D.investigations.items;
  const used = items.filter((i) => i.status === "scenario" || i.status === "notes").length;
  const onMap = items.filter((i) => i.status === "map").length;
  const imported = items.reduce((s, i) => s + i.n_imported, 0);
  return (
    <>
      <h1 className="hero">
        {items.length} investigations. <span>What each one studied, and what we do with it.</span>
      </h1>
      <div className="row" style={{ gap: 40 }}>
        <div className="stat" style={{ flex: "1 1 240px" }}>
          <b>{used}</b>
          <span>feed a scenario or are quoted in one.</span>
        </div>
        <div className="stat" style={{ flex: "1 1 240px" }}>
          <b>{onMap}</b>
          <span>appear on the map only: their PSI table gives conditions but no outcome.</span>
        </div>
        <div className="stat" style={{ flex: "1 1 240px" }}>
          <b className="fire">{items.length - used - onMap}</b>
          <span>are not used. The reason is stated on each card.</span>
        </div>
        <div className="stat" style={{ flex: "1 1 240px" }}>
          <b>{imported.toLocaleString("en-US")}</b>
          <span>tests imported from PSI, each traceable to a file and a row.</span>
        </div>
      </div>

      <section aria-label="PSI combustion investigations" className="inv-grid">
        {items.map((i) => {
          const st = STATUS[i.status];
          return (
            <article key={i.accession} className={`inv ${st.cls}`}>
              <div className="inv-top">
                <span className="mono small muted">{i.accession}</span>
                <span className={`tag ${st.cls}`}>{st.label}</span>
              </div>
              <h2>{i.name}</h2>
              {i.name !== i.title && <p className="small muted" style={{ margin: 0 }}>{i.title}</p>}
              {i.objective && <p className="inv-obj">{i.objective}</p>}
              <p className="small" style={{ margin: 0 }}>
                <span className="muted">In this tool: </span>
                {i.note}
              </p>
              <div className="inv-foot">
                <span className="mono small muted">
                  {i.n_imported > 0 ? `${i.n_imported} tests imported` : "no test imported"}
                  {i.platform && i.platform !== "Not Applicable" ? ` · ${i.platform.replace("International Space Station (ISS)", "ISS")}` : ""}
                </span>
                <span className="inv-links">
                  {i.scenarios.map((s) => (
                    <Link key={s} href={`/scenario/${s}/iss`} title={scenarioById(s)?.title}>
                      {s.toUpperCase()}
                    </Link>
                  ))}
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    PSI ↗
                  </a>
                </span>
              </div>
            </article>
          );
        })}
      </section>
      <p className="small muted" style={{ margin: 0 }}>
        Objectives are quoted from the PSI repository (metadata fetched {D.investigations.fetched}); long texts are cut at a sentence end.
        The count of 24 covers every PSI investigation filed under combustion.
      </p>

      <section aria-label="Back on Earth" className="stack" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingBottom: 12 }}>
          <h2 className="section">Back on Earth</h2>
          <span className="small muted">Fire-safety technology that came out of spaceflight, from NASA Spinoff.</span>
        </div>
        {D.spinoffs.map((s) => (
          <div className="study" key={s.name} style={{ gridTemplateColumns: "72px minmax(0, 1fr) auto" }}>
            <b style={{ fontSize: 22 }}>{s.year}</b>
            <span className="stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{s.name}</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--soft)" }}>{s.text}</span>
            </span>
            <span className="inv-links">
              {s.scenarios.map((id) => (
                <Link key={id} href={`/scenario/${id}/iss`}>
                  {id.toUpperCase()}
                </Link>
              ))}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                NASA ↗
              </a>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
