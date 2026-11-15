import { D } from "@/lib/data";

const KIND = { psi_dataset: "PSI dataset", article: "paper", report: "report", standard: "standard", upcoming: "upcoming" } as const;
const ACCESS = { open: "open", restricted: "restricted", pending: "pending" } as const;

function References({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s;]+)/g).map((part, i) =>
        part.startsWith("http") ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function SourcesPage() {
  const counts: Record<string, number> = {};
  for (const e of D.experiments) counts[e.source_id] = (counts[e.source_id] ?? 0) + 1;
  return (
    <>
      <h1 className="hero">
        Sources. <span>Where every value comes from.</span>
      </h1>
      <div className="table-scroll">
        <table className="src">
          <thead>
            <tr>
              <th>SOURCE</th>
              <th>TYPE</th>
              <th>ACCESS</th>
              <th>TESTS</th>
              <th>REFERENCE</th>
            </tr>
          </thead>
          <tbody>
            {D.sources.map((s) => (
              <tr key={s.source_id}>
                <td>
                  {s.title}
                  {s.year && <span className="muted"> ({s.year})</span>}
                </td>
                <td>{KIND[s.kind]}</td>
                <td>
                  <span className={`tag ${s.access}`}>{ACCESS[s.access]}</span>
                </td>
                <td className="mono">{counts[s.source_id] ?? "—"}</td>
                <td className="small">{s.reference && <References text={s.reference} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-label="Official challenge resources" className="stack" style={{ gap: 12 }}>
        <h2 className="section">Official challenge resources</h2>
        <div className="table-scroll">
          <table className="src">
            <thead>
              <tr>
                <th>RESOURCE</th>
                <th>HOW IT IS USED HERE</th>
              </tr>
            </thead>
            <tbody>
              {D.challenge_resources.map((r) => (
                <tr key={r.url}>
                  <td>
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.title}
                    </a>
                  </td>
                  <td>{r.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="small muted">
        PSI is the source of every dataset marked “PSI dataset”. It holds no partial-gravity combustion data yet, so the lunar- and
        Martian-gravity tests shown in this tool come from the papers and NASA reports listed above, each cited to the page.{" "}
        <a href="/data/experiments.csv" download>
          Download all imported tests (CSV)
        </a>{" "}
        ·{" "}
        <a href="/data/answers.json" download>
          engine answers (JSON)
        </a>
      </p>
      <p className="small muted">
        Not accessible: MAPTIS (the materials certification database) and NASA Glenn’s ACME and Saffire data portals. The PSI AWS
        Open Data bucket does not include combustion.
      </p>
    </>
  );
}
