import Link from "next/link";
import InvestigationExplorer from "@/components/InvestigationExplorer";
import { D } from "@/lib/data";

export default function InvestigationsPage() {
  const items = D.investigations.items;
  const used = items.filter((i) => i.status === "scenario" || i.status === "notes").length;
  const summarised = items.filter((i) => i.status === "map" || i.status === "profile").length;
  const imported = items.reduce((s, i) => s + i.n_imported, 0);
  return (
    <>
      <h1 className="hero">
        {items.length} investigations. <span>What each one studied, ranked for where crews will live.</span>
      </h1>
      <div className="row" style={{ gap: 40 }}>
        <div className="stat" style={{ flex: "1 1 240px" }}>
          <b>{used}</b>
          <span>feed a scenario or are quoted in one.</span>
        </div>
        <div className="stat" style={{ flex: "1 1 240px" }}>
          <b>{summarised}</b>
          <span>are summarised only: PSI’s table gives conditions or test days, but no outcome.</span>
        </div>
        <div className="stat" style={{ flex: "1 1 240px" }}>
          <b className="fire">{items.length - used - summarised}</b>
          <span>are not used. The reason is stated on each card.</span>
        </div>
        <div className="stat" style={{ flex: "1 1 240px" }}>
          <b>{imported.toLocaleString("en-US")}</b>
          <span>
            tests imported, each traceable to a file and a row.{" "}
            <a href="/data/experiments.csv" download>
              Download the CSV
            </a>
          </span>
        </div>
      </div>

      <InvestigationExplorer
        items={items}
        rankings={D.habitat_ranking}
        scenarioTitles={Object.fromEntries(D.scenarios.map((s) => [s.scenario_id, s.title]))}
      />

      <p className="small muted" style={{ margin: 0 }}>
        Objectives are quoted from the PSI repository (metadata fetched {D.investigations.fetched}); long texts are cut at a sentence end.
        Pillars, hardware families and the links between investigations follow the challenge statement. Ranges are computed from the
        imported tests, or read from PSI’s day-by-day summary tables. The 24 cover every PSI investigation filed under combustion.
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
