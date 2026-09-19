"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  CandlestickData,
  UTCTimestamp,
  LineStyle,
  MouseEventParams,
} from "lightweight-charts";

type Candle = { time: number; open: number; high: number; low: number; close: number };

export default function CandleChart({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const drawModeRef = useRef(false);

  const [drawMode, setDrawMode] = useState(false);
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const el = containerRef.current;
    el.innerHTML = "";

    const width = el.clientWidth || 800;
    const height = el.clientHeight || 500;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        // Quitamos el logo de atribución de la librería: ya damos crédito
        // por escrito más abajo en la página, como permite su licencia.
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      width,
      height,
      timeScale: { borderColor: "#1e293b", timeVisible: true },
      rightPriceScale: { borderColor: "#1e293b" },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    series.setData(data);
    chart.timeScale().fitContent();
    chartRef.current = chart;
    seriesRef.current = series;
    linesRef.current = [];
    setLineCount(0);

    // Al hacer clic en el gráfico (con el modo "marcar" activado), dibujamos
    // una línea horizontal de soporte/resistencia en el precio donde se hizo clic.
    const handleClick = (param: MouseEventParams) => {
      if (!drawModeRef.current) return;
      if (!param.point || !seriesRef.current) return;

      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (price === null) return;

      const line = seriesRef.current.createPriceLine({
        price,
        color: "#eab308",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "S/R",
      });

      linesRef.current.push(line);
      setLineCount(linesRef.current.length);
    };

    chart.subscribeClick(handleClick);

    const handleResize = () => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.unsubscribeClick(handleClick);
      chart.remove();
    };
  }, [candles]);

  const borrarLineas = () => {
    if (!seriesRef.current) return;
    linesRef.current.forEach((line) => seriesRef.current!.removePriceLine(line));
    linesRef.current = [];
    setLineCount(0);
  };

  if (candles.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500">
        Cargando velas...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-2">
        <button
          onClick={() => setDrawMode((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            drawMode
              ? "bg-yellow-500 text-slate-950 border-yellow-400"
              : "bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800"
          }`}
        >
          {drawMode ? "Haz clic en el gráfico para marcar ✓" : "✏️ Marcar soporte/resistencia"}
        </button>
        {lineCount > 0 && (
          <button
            onClick={borrarLineas}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 text-slate-300 border border-slate-700 hover:bg-slate-800 transition"
          >
            🗑️ Borrar líneas ({lineCount})
          </button>
        )}
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
