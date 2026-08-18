"use client";

type PricePoint = { date: string; price: number };

export default function PriceChart({ data }: { data: PricePoint[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500">
        No hay suficientes datos para graficar
      </div>
    );
  }

  const width = 1000;
  const height = 400;
  const padding = { top: 20, right: 70, bottom: 30, left: 10 };

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.price - minPrice) / priceRange) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? "#22c55e" : "#ef4444";

  // Líneas de referencia horizontales (5 niveles de precio)
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const price = minPrice + (priceRange * i) / 4;
    const y = padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
    return { price, y };
  });

  // Etiquetas de fecha (inicio, medio, fin)
  const dateLabels = [
    data[0],
    data[Math.floor(data.length / 2)],
    data[data.length - 1],
  ];

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Líneas de cuadrícula y etiquetas de precio */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={g.y}
              x2={width - padding.right}
              y2={g.y}
              stroke="#1e293b"
              strokeWidth={1}
            />
            <text
              x={width - padding.right + 8}
              y={g.y + 4}
              fill="#64748b"
              fontSize="11"
            >
              ${g.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}

        {/* Área bajo la línea */}
        <path d={areaPath} fill={lineColor} opacity={0.08} />

        {/* Línea de precio */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} />

        {/* Punto final */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill={lineColor}
        />

        {/* Etiquetas de fecha abajo */}
        {dateLabels.map((d, i) => {
          const idx = data.indexOf(d);
          const x = padding.left + (idx / (data.length - 1)) * chartWidth;
          return (
            <text
              key={i}
              x={x}
              y={height - 8}
              fill="#64748b"
              fontSize="11"
              textAnchor={i === 0 ? "start" : i === dateLabels.length - 1 ? "end" : "middle"}
            >
              {d.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
