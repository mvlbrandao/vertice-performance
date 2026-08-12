/** Mini gráfico da evolução do score geral, feito pra caber no relatório
 *  impresso: sem interação, sem cor de fundo (economiza tinta). */
export function ReportScoreLine({ points }: { points: { date: string; value: number }[] }) {
  const w = 620;
  const h = 110;
  const padL = 26;
  const padB = 18;
  const innerW = w - padL - 8;
  const innerH = h - padB - 8;
  const x = (i: number) => padL + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => 8 + innerH - (v / 99) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 50, 99].map((v) => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={w - 8} y2={y(v)} stroke="#E4DCC8" strokeWidth={1} />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize={8} fill="#9A9484">
            {v}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#111111" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} fill="#111111" />
      ))}
      <text x={padL} y={h - 4} fontSize={8} fill="#9A9484">{points[0]?.date.slice(5)}</text>
      <text x={w - 8} y={h - 4} textAnchor="end" fontSize={8} fill="#9A9484">
        {points[points.length - 1]?.date.slice(5)}
      </text>
    </svg>
  );
}
