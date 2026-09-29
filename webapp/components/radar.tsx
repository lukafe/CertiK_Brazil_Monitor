const TAU = Math.PI * 2;

function ponto(cx: number, cy: number, raio: number, i: number, n: number) {
  const ang = -Math.PI / 2 + (i / n) * TAU;
  return [cx + raio * Math.cos(ang), cy + raio * Math.sin(ang)] as const;
}

function poligono(cx: number, cy: number, raio: number, n: number) {
  return Array.from({ length: n }, (_, i) => ponto(cx, cy, raio, i, n).join(",")).join(" ");
}

export default function Radar({
  eixos,
  size = 300,
}: {
  eixos: { label: string; valor: number }[]; // valor 0–100
  size?: number;
}) {
  const n = eixos.length;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = size / 2 - 52;

  const dados = eixos
    .map((e, i) => ponto(cx, cy, (Math.max(0, Math.min(100, e.valor)) / 100) * R, i, n).join(","))
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
      {[1, 0.75, 0.5, 0.25].map((f) => (
        <polygon
          key={f}
          points={poligono(cx, cy, R * f, n)}
          fill={f === 1 ? "var(--surface-raised)" : "none"}
          stroke="var(--edge-subtle)"
          strokeWidth="1"
        />
      ))}
      {eixos.map((_, i) => {
        const [x, y] = ponto(cx, cy, R, i, n);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--edge-subtle)" strokeWidth="1" />;
      })}
      <polygon points={dados} fill="var(--accent)" fillOpacity="0.3" stroke="var(--accent)" strokeWidth="1.5" />
      {eixos.map((e, i) => {
        const [px, py] = ponto(cx, cy, (Math.max(0, Math.min(100, e.valor)) / 100) * R, i, n);
        return <circle key={i} cx={px} cy={py} r="2.5" fill="var(--accent)" />;
      })}
      {eixos.map((e, i) => {
        const [x, y] = ponto(cx, cy, R + 26, i, n);
        const anchor = Math.abs(x - cx) < 10 ? "middle" : x > cx ? "start" : "end";
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fill="var(--fg-secondary)"
            fontSize="11"
          >
            {e.label}
          </text>
        );
      })}
    </svg>
  );
}
