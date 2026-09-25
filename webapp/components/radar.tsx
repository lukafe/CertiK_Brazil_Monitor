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
          fill={f === 1 ? "#16191d" : "none"}
          stroke="#262b31"
          strokeWidth="1"
        />
      ))}
      {eixos.map((_, i) => {
        const [x, y] = ponto(cx, cy, R, i, n);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#262b31" strokeWidth="1" />;
      })}
      <polygon points={dados} fill="#3fe0a8" fillOpacity="0.3" stroke="#3fe0a8" strokeWidth="1.5" />
      <polygon points={dados} fill="#fbbf24" fillOpacity="0.12" />
      {eixos.map((e, i) => {
        const [px, py] = ponto(cx, cy, (Math.max(0, Math.min(100, e.valor)) / 100) * R, i, n);
        return <circle key={i} cx={px} cy={py} r="2.5" fill="#3fe0a8" />;
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
            fill="#94a3b8"
            fontSize="11"
          >
            {e.label}
          </text>
        );
      })}
    </svg>
  );
}
