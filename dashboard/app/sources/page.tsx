import { D } from "@/lib/data";

const KIND = { psi_dataset: "jeu PSI", article: "article", report: "rapport", standard: "norme", upcoming: "à venir" } as const;
const ACCESS = { open: "libre", restricted: "restreint", pending: "en attente" } as const;

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
        Sources. <span>D’où vient chaque valeur.</span>
      </h1>
      <div className="table-scroll">
        <table className="src">
          <thead>
            <tr>
              <th>SOURCE</th>
              <th>TYPE</th>
              <th>ACCÈS</th>
              <th>ESSAIS</th>
              <th>RÉFÉRENCE</th>
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
        Inaccessibles : MAPTIS (base de certification des matériaux) et les portails ACME et Saffire de NASA Glenn. Le bucket AWS Open
        Data de PSI ne contient pas la combustion.
      </p>
    </>
  );
}
