export default function Sparkline({
  valores,
  width = 260,
  height = 56,
}: {
  valores: number[];
  width?: number;
  height?: number;
}) {
  if (valores.length === 0) return null;
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const range = Math.max(1, max - min);
  const px = (i: number) =>
    valores.length === 1 ? width / 2 : 6 + (i / (valores.length - 1)) * (width - 12);
  const py = (v: number) => height - 8 - ((v - min) / range) * (height - 16);
  const pts = valores.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const area = `6,${height - 4} ${pts.join(" ")} ${width - 6},${height - 4}`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block">
      <polygon points={area} fill="#3fe0a8" fillOpacity="0.12" />
      <polyline points={pts.join(" ")} fill="none" stroke="#3fe0a8" strokeWidth="1.8" strokeLinejoin="round" />
      {valores.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r="2.5" fill="#3fe0a8" />
      ))}
    </svg>
  );
}
