// Barres lumineuses : la confiance comme lumière, jamais la couleur seule.
export default function Lumens({
  level,
  total = 4,
  variant,
  label,
}: {
  level: number;
  total?: number;
  variant?: "wide" | "big" | "fire";
  label?: string;
}) {
  return (
    <span
      className={`lumens ${variant ?? ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={i < level ? "on" : undefined}
          style={variant === "big" ? { height: 28 + i * 18, transitionDelay: `${i * 90}ms` } : { transitionDelay: `${i * 60}ms` }}
        />
      ))}
    </span>
  );
}
