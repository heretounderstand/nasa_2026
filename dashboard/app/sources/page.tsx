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
      <p className="small muted">
        Not accessible: MAPTIS (the materials certification database) and NASA Glenn’s ACME and Saffire data portals. The PSI AWS
        Open Data bucket does not include combustion.
      </p>
    </>
  );
}
