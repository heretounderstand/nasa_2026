"use client";

// Carte de la connaissance : expériences, couverture (halos) et limite
// d'inflammabilité, dans trois projections. Positions horizontales légèrement
// dispersées pour la lisibilité (déterministe, signalé sous la carte).
// Deux géométries : large (bureau) et portrait (téléphone, < 720 px), où
// l'encart zoomé passe sous la carte au lieu de la recouvrir.
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { LimitBand, Upcoming } from "@/lib/data";

export interface MapPoint {
  id: string;
  src: string;
  platform: string;
  g: number | null;
  o2: number | null;
  p: number | null;
  flow: number | null;
  outcome: string;
  where: string;
}
export interface MapMarker {
  id: string;
  label: string;
  g: number | null;
  o2: number | null;
  p: number | null;
}
type Proj = "gravity" | "pressure" | "flow";

const PROJ: Record<Proj, { label: string; key: "g" | "p" | "flow"; min: number; max: number; ticks: [number, string][]; axis: string }> = {
  gravity: { label: "O₂ × GRAVITY", key: "g", min: 0, max: 1, ticks: [[0, "0 g"], [0.5, "0.5 g"], [1, "1 g"]], axis: "GRAVITY" },
  pressure: { label: "O₂ × PRESSURE", key: "p", min: 0, max: 520, ticks: [[0, "0"], [101.3, "101 kPa"], [260, "260"], [520, "520 kPa"]], axis: "PRESSURE (kPa)" },
  flow: { label: "O₂ × FLOW", key: "flow", min: 0, max: 40, ticks: [[0, "0"], [20, "20"], [40, "40 cm/s"]], axis: "FLOW (cm/s)" },
};
const O2MIN = 0.1, O2MAX = 0.4;

// Géométries (unités SVG). En portrait, 1 unité ≈ 1 px sur un téléphone.
const GEOM = {
  wide: { W: 1000, H: 560, X0: 80, X1: 960, Y0: 40, Y1: 500, tickY: 526, axisY: 550, yLabelX: 68, oxyX: 22, halo: 30, pt: 3.2, jit: 10, zeroDx: 46, label: 0.55 },
  compact: { W: 400, H: 620, X0: 46, X1: 384, Y0: 30, Y1: 560, tickY: 582, axisY: 606, yLabelX: 40, oxyX: 12, halo: 22, pt: 3, jit: 8, zeroDx: 30, label: 0.45 },
};
type Geom = (typeof GEOM)["wide"];

const fr = (x: number, d = 1) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(x);
const PLATFORM: Record<string, string> = {
  iss: "ISS", drop_tower: "drop tower", drop_tower_centrifuge: "drop tower with centrifuge",
  parabolic_flight: "parabolic flight", suborbital_centrifuge: "suborbital rocket", ground: "ground", lunar_surface: "lunar surface",
};
const OUTCOME: Record<string, string> = {
  extinction: "went out", sustained: "sustained flame", descriptive: "conditions only",
  limit_o2: "O₂ limit", detector_signal: "smoke measured", spread_rate: "spread rate",
};

function jitter(id: string, amp: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000) * amp - amp / 2;
}

// Largeur d'écran : rendu serveur en version large, puis ajustement au client.
const QUERY = "(max-width: 720px)";
function useCompact() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export default function KnowledgeMap({
  points, markers, upcoming, band, sourceTitles,
}: {
  points: MapPoint[];
  markers: MapMarker[];
  upcoming: Upcoming[];
  band: LimitBand;
  sourceTitles: Record<string, string>;
}) {
  const compact = useCompact();
  const G: Geom = compact ? GEOM.compact : GEOM.wide;
  const [proj, setProj] = useState<Proj>("gravity");
  const [layers, setLayers] = useState({ pts: true, cov: true, lim: true });
  const [tip, setTip] = useState<{ x: number; y: number; w: number; p: MapPoint } | null>(null);
  const P = PROJ[proj];
  const sx = (v: number) => G.X0 + ((Math.min(Math.max(v, P.min), P.max) - P.min) / (P.max - P.min)) * (G.X1 - G.X0);
  const sy = (o: number) => G.Y1 - ((o - O2MIN) / (O2MAX - O2MIN)) * (G.Y1 - G.Y0);

  const placed = useMemo(
    () =>
      points.map((p) => {
        const xv = p[P.key];
        const visible = xv != null && p.o2 != null && p.o2 >= O2MIN && p.o2 <= O2MAX;
        return {
          p,
          visible,
          cx: visible ? sx(xv!) + jitter(p.id, G.jit) : G.X0,
          cy: p.o2 != null ? sy(Math.min(Math.max(p.o2, O2MIN), O2MAX)) : G.Y1,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, proj, compact],
  );
  const nVisible = placed.filter((d) => d.visible).length;
  const layerDefs: [keyof typeof layers, string, string][] = [
    ["pts", "Experiments", "#EDEBE6"],
    ["cov", "Coverage", "#CFE8FF"],
    ["lim", "Flammability limit", "#FF7A2F"],
  ];
  const L = band.levels;
  const minLevel = L.reduce((m, l) => (l.low < m.low ? l : m), L[0]);
  const showBand = proj === "gravity" && layers.lim;

  // Survol (souris) ou toucher (téléphone) d'un point : provenance.
  function pick(e: React.PointerEvent<SVGGElement>) {
    const i = (e.target as SVGElement).dataset?.i;
    if (i == null) return e.pointerType === "mouse" ? setTip(null) : undefined;
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, p: placed[Number(i)].p });
  }

  return (
    <section aria-label="Knowledge map" className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div className="seg" role="group" aria-label="Projection">
          {(Object.keys(PROJ) as Proj[]).map((k) => (
            <button key={k} type="button" aria-pressed={proj === k} onClick={() => setProj(k)}>
              {PROJ[k].label}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Layers">
          {layerDefs.map(([k, label, color]) => (
            <button
              key={k}
              type="button"
              aria-pressed={layers[k]}
              onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}
              style={{ fontFamily: "var(--display)", fontSize: 13 }}
            >
              <span style={{ width: 10, height: 10, background: layers[k] ? color : "#1E252E" }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel map" onMouseLeave={() => setTip(null)}>
        <svg
          viewBox={`0 0 ${G.W} ${G.H}`}
          className={compact ? undefined : "wide"}
          role="img"
          aria-label={`${nVisible} experiments plotted by ${P.axis.toLowerCase()} and oxygen level`}
          onClick={(e) => e.target === e.currentTarget && setTip(null)}
        >
          <defs>
            <radialGradient id="glow">
              <stop offset="0%" stopColor="#CFE8FF" stopOpacity="0.075" />
              <stop offset="100%" stopColor="#CFE8FF" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g aria-hidden="true" style={{ opacity: layers.cov ? 1 : 0, transition: "opacity .4s" }}>
            {placed.map(({ p, cx, cy, visible }) => (
              <circle key={p.id} className="pt" r={G.halo} fill="url(#glow)" style={{ cx, cy, opacity: visible ? 1 : 0 } as React.CSSProperties} />
            ))}
          </g>

          <g stroke="#1E252E">
            {[0.1, 0.2, 0.3, 0.4].map((o) => (
              <line key={o} x1={G.X0} x2={G.X1} y1={sy(o)} y2={sy(o)} />
            ))}
          </g>
          <g fontFamily="var(--mono)" fontSize="12" fill="#98A0AA">
            {[0.1, 0.2, 0.3, 0.4].map((o) => (
              <text key={o} x={G.yLabelX} y={sy(o) + 4} textAnchor="end">{`${o * 100}%`}</text>
            ))}
            {P.ticks
              .filter(([, t]) => !compact || t !== "260")
              .map(([v, t], i, arr) => (
                <text key={t} x={sx(v)} y={G.tickY} textAnchor={compact && i === arr.length - 1 ? "end" : "middle"}>{t}</text>
              ))}
            <text x={(G.X0 + G.X1) / 2} y={G.axisY} textAnchor="middle" fill="#EDEBE6">{P.axis}</text>
            <text x={G.oxyX} y={(G.Y0 + G.Y1) / 2} textAnchor="middle" fill="#EDEBE6" transform={`rotate(-90 ${G.oxyX} ${(G.Y0 + G.Y1) / 2})`}>OXYGEN</text>
          </g>

          <AnimatePresence>
            {proj === "gravity" && (
              <motion.g key="grav" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <g stroke="#5D6670" strokeDasharray="3 5">
                  <line x1={sx(0.165)} x2={sx(0.165)} y1={G.Y0} y2={G.Y1} />
                  <line x1={sx(0.38)} x2={sx(0.38)} y1={G.Y0} y2={G.Y1} />
                </g>
                <g fontFamily="var(--mono)" fontSize="12" fill="#EDEBE6">
                  <text x={sx(0.165) + 6} y={G.Y0 + 18}>{compact ? "MOON" : "MOON 0.16 g"}</text>
                  <text x={sx(0.38) + 6} y={G.Y0 + 18}>{compact ? "MARS" : "MARS 0.38 g"}</text>
                </g>
                {/* En portrait, la note descend dans la zone vide pour ne pas croiser FM2. */}
                <text x={sx(0.38) + 6} y={compact ? sy(0.31) : G.Y0 + 60} fill="#98A0AA" fontSize="13">Mars habitat:</text>
                <text x={sx(0.38) + 6} y={(compact ? sy(0.31) : G.Y0 + 60) + 17} fill="#98A0AA" fontSize="13">atmosphere not defined</text>
                {layers.lim && (
                  <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <polygon
                      points={[...L.map((l) => `${sx(l.gravity_g)},${sy(l.high)}`), ...[...L].reverse().map((l) => `${sx(l.gravity_g)},${sy(l.low)}`)].join(" ")}
                      fill="#FF7A2F" fillOpacity={0.22}
                    />
                    <motion.polyline
                      points={L.map((l) => `${sx(l.gravity_g)},${sy((l.low + l.high) / 2)}`).join(" ")}
                      fill="none" stroke="#FF7A2F" strokeWidth={2.5}
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                    <g fontSize="13" fill="#FFB27A">
                      <text x={sx(G.label)} y={sy(0.147) - 10}>can burn ↑</text>
                      <text x={sx(G.label)} y={sy(0.137) + 22}>↓ goes out</text>
                    </g>
                    {!compact && <Inset band={band} points={points} box={{ bx: 590, by: 96, bw: 350, bh: 200 }} />}
                  </motion.g>
                )}
              </motion.g>
            )}
          </AnimatePresence>

          <g style={{ opacity: layers.pts ? 1 : 0, transition: "opacity .4s" }} onPointerMove={pick} onPointerDown={pick}>
            {placed.map(({ p, cx, cy, visible }, i) => (
              <circle
                key={p.id}
                data-i={i}
                className="pt"
                r={G.pt}
                fill="#EDEBE6"
                fillOpacity={0.85}
                style={{ cx, cy, opacity: visible ? 1 : 0, pointerEvents: visible && layers.pts ? "auto" : "none" } as React.CSSProperties}
              />
            ))}
          </g>

          <g fontSize="13">
            {upcoming.map((u, i) => {
              const xv = proj === "gravity" ? u.gravity_g : proj === "pressure" ? u.pressure_kpa : null;
              if (xv == null) return null;
              const x = sx(xv), y = sy(u.o2_mole_fraction);
              return (
                <g key={u.id}>
                  <rect x={x - 6} y={y - 6} width={12} height={12} fill="none" stroke="#FF7A2F" strokeDasharray="2 2" transform={`rotate(45 ${x} ${y})`}>
                    <title>{`${u.id} (upcoming) · ${u.provenance}`}</title>
                  </rect>
                  {i === 0 && <text x={x + 12} y={y + 4} fill="#FFB27A">FM2 · upcoming</text>}
                </g>
              );
            })}
            {markers.map((m) => {
              const xv = proj === "gravity" ? m.g : proj === "pressure" ? m.p : null;
              if (xv == null || m.o2 == null) return null;
              const x = sx(xv), y = sy(m.o2), moon = m.id === "moon";
              const right = x > G.X1 - 160, dx = xv === 0 ? G.zeroDx : 14;
              const color = m.id === "earth" ? "#EDEBE6" : moon ? "#FF7A2F" : "#CFE8FF";
              const label = compact && moon ? `Moon · ${fr(m.o2 * 100)}%` : `${m.label} · ${fr(m.o2 * 100)}%`;
              return (
                <g key={m.id}>
                  {moon && <circle className="pg" cx={x} cy={y} r={10} fill="none" stroke="#FF7A2F" strokeWidth={2} style={{ transformOrigin: `${x}px ${y}px` }} />}
                  <rect x={x - 7} y={y - 7} width={14} height={14} fill={moon ? "#FF7A2F" : "none"} stroke={color} strokeWidth={2} transform={`rotate(45 ${x} ${y})`} />
                  <text x={right ? x - 14 : x + dx} y={y + 4} textAnchor={right ? "end" : "start"} fill={color} fontWeight={600} paintOrder="stroke" stroke="#07090C" strokeWidth={4}>
                    {label}
                  </text>
                  {m.id === "earth" && <text x={x - 14} y={y + 20} textAnchor="end" fill="#98A0AA">reference: certification</text>}
                </g>
              );
            })}
          </g>
        </svg>
        {tip && (
          <div className="tip" style={{ left: Math.max(8, Math.min(tip.x + 14, tip.w - 250)), top: tip.y + 14 }}>
            <b>{sourceTitles[tip.p.src] ?? tip.p.src}</b>
            {[PLATFORM[tip.p.platform] ?? tip.p.platform, tip.p.g != null ? `${fr(tip.p.g, 3)} g` : null, tip.p.o2 != null ? `O₂ ${fr(tip.p.o2 * 100)}%` : null, tip.p.p != null ? `${fr(tip.p.p)} kPa` : null]
              .filter(Boolean)
              .join(" · ")}
            <br />
            {OUTCOME[tip.p.outcome] ?? tip.p.outcome}
            <div className="mono">{tip.p.where}</div>
          </div>
        )}
      </div>

      {compact && showBand && (
        <div className="panel map">
          <svg viewBox="0 0 400 290" role="img" aria-label="Close-up of the flammability limit">
            <Inset band={band} points={points} box={{ bx: 58, by: 54, bw: 316, bh: 190 }} />
          </svg>
        </div>
      )}

      <p className="small muted" style={{ margin: 0 }}>
        {nVisible} experiments plotted (known O₂, between 10% and 40%), slightly spread horizontally for legibility.{" "}
        {compact ? "Tap a point for its provenance." : "Hover over a point for its provenance."}{" "}
        {proj === "gravity"
          ? `Orange band: flammability limit of ${band.material} at ${fr(band.pressure_kpa)} kPa, between the highest-oxygen test that went out and the lowest-oxygen test that stayed lit at each gravity level (values read from the figure, 5 s tests). Minimum near ${fr(minLevel.gravity_g, 2)} g.`
          : "The Mars marker is not shown: its atmosphere is not defined."}
      </p>
    </section>
  );
}

// Encart : la limite agrandie, avec les essais réels (stables / éteints).
function Inset({ band, points, box }: { band: LimitBand; points: MapPoint[]; box: { bx: number; by: number; bw: number; bh: number } }) {
  const { bx, by, bw, bh } = box;
  const lo = 0.13, hi = 0.155;
  const iy = (o: number) => by + bh - ((o - lo) / (hi - lo)) * bh;
  const ix = (g: number) => bx + g * bw;
  const L = band.levels;
  const pts = points.filter((p) => p.src === band.source_id && p.g != null && p.o2 != null);
  return (
    <g aria-label="Close-up of the flammability limit">
      <rect x={bx - 44} y={by - 30} width={bw + 60} height={bh + 62} fill="#07090C" stroke="#1E252E" />
      <text x={bx - 34} y={by - 12} fontFamily="var(--mono)" fontSize="11" fill="#98A0AA">{`ZOOM · PMMA · ${fr(band.pressure_kpa)} kPa`}</text>
      {[0.13, 0.14, 0.15].map((o) => (
        <g key={o}>
          <line x1={bx} x2={bx + bw} y1={iy(o)} y2={iy(o)} stroke="#1E252E" />
          <text x={bx - 6} y={iy(o) + 4} textAnchor="end" fontFamily="var(--mono)" fontSize="11" fill="#98A0AA">{`${Math.round(o * 100)}%`}</text>
        </g>
      ))}
      {([[0, "0"], [0.165, "Moon"], [0.38, "Mars"], [1, "1 g"]] as [number, string][]).map(([g, t]) => (
        <text key={t} x={ix(g)} y={by + bh + 18} textAnchor={g === 1 ? "end" : "middle"} fontFamily="var(--mono)" fontSize="11" fill="#98A0AA">{t}</text>
      ))}
      <polygon
        points={[...L.map((l) => `${ix(l.gravity_g)},${iy(l.high)}`), ...[...L].reverse().map((l) => `${ix(l.gravity_g)},${iy(l.low)}`)].join(" ")}
        fill="#FF7A2F" fillOpacity={0.22}
      />
      {pts.map((p, i) => {
        const x = ix(p.g!), y = iy(p.o2!);
        const t = `${p.outcome === "sustained" ? "steady flame" : "went out"} · ${fr(p.g!, 2)} g · O₂ ${fr(p.o2! * 100, 2)}%`;
        return (
          <g key={p.id} className="pop" style={{ animationDelay: `${0.1 + i * 0.02}s` }}>
            {p.outcome === "sustained" ? (
              <circle cx={x} cy={y} r={4} fill="#CFE8FF"><title>{t}</title></circle>
            ) : (
              <path d={`M${x - 4},${y - 4}l8,8m0,-8l-8,8`} stroke="#FF7A2F" strokeWidth={2}><title>{t}</title></path>
            )}
          </g>
        );
      })}
      <g fontSize="12">
        <circle cx={bx + bw - 160} cy={by - 15} r={4} fill="#CFE8FF" />
        <text x={bx + bw - 152} y={by - 11} fill="#EDEBE6">steady</text>
        <path d={`M${bx + bw - 102},${by - 19}l8,8m0,-8l-8,8`} stroke="#FF7A2F" strokeWidth={2} />
        <text x={bx + bw - 88} y={by - 11} fill="#EDEBE6">went out</text>
      </g>
    </g>
  );
}
