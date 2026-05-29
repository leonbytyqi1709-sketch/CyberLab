import { useId } from "react";

export interface Series {
  values: number[];
  color: string;
  /** Verlaufsfüllung unter der Linie (default: false) */
  fill?: boolean;
}

interface LineChartProps {
  series: Series[];
  /** Obergrenze der Y-Achse. Ohne Angabe aus den Daten berechnet. */
  max?: number;
  height?: number;
}

const VIEW_W = 600; // interne ViewBox-Breite; SVG skaliert per width=100%

/** Glühendes Liniendiagramm aus reinem SVG — keine externe Chart-Lib. */
export default function LineChart({ series, max, height = 130 }: LineChartProps) {
  const uid = useId().replace(/:/g, "");
  const H = height;
  const padY = 8;

  const dataMax =
    max ??
    Math.max(
      1,
      ...series.flatMap((s) => s.values),
    ) * 1.15;

  const n = Math.max(...series.map((s) => s.values.length), 2);
  const xAt = (i: number) => (i / (n - 1)) * VIEW_W;
  const yAt = (v: number) =>
    H - padY - (Math.min(v, dataMax) / dataMax) * (H - padY * 2);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      className="block"
    >
      {/* dezente Grundlinien */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={0}
          x2={VIEW_W}
          y1={H * f}
          y2={H * f}
          stroke="#1E2028"
          strokeWidth={1}
        />
      ))}

      {series.map((s, idx) => {
        const pts = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`);
        const line = `M ${pts.join(" L ")}`;
        const area = `M ${xAt(0)},${H} L ${pts.join(" L ")} L ${xAt(
          s.values.length - 1,
        )},${H} Z`;
        const gid = `grad-${uid}-${idx}`;
        return (
          <g key={idx}>
            {s.fill && (
              <>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.38} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#${gid})`} />
              </>
            )}
            <path
              d={line}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${s.color}aa)` }}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}
