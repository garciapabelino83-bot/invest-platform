"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

type LineaMarcada = {
  localId: number;
  price: number;
  priceLine: IPriceLine;
  alertId: number | null; // id en la base de datos si ya tiene aviso activado
  guardando: boolean;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function CandleChart({
  candles,
  coin,
  isPro,
  proEmail,
}: {
  candles: Candle[];
  coin: string;
  isPro: boolean;
  proEmail: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const drawModeRef = useRef(false);
  const nextLocalId = useRef(1);

  const [drawMode, setDrawMode] = useState(false);
  const [lineas, setLineas] = useState<LineaMarcada[]>([]);
  const [avisoMensaje, setAvisoMensaje] = useState<string | null>(null);

  // Cargar avisos ya guardados de este activo (si el usuario ya había
  // marcado líneas antes, para que sigan ahí cuando vuelve a entrar).
  useEffect(() => {
    if (!isPro || !proEmail || !seriesRef.current) return;

    fetch(`/api/alerts?email=${encodeURIComponent(proEmail)}`)
      .then((res) => res.json())
      .then((data) => {
        const existentes = (data.alerts || []).filter(
          (a: { coin: string; triggered_at: string | null }) =>
            a.coin === coin && !a.triggered_at
        );
        existentes.forEach((a: { id: number; price: string | number }) => {
          if (!seriesRef.current) return;
          const price = Number(a.price);
          const priceLine = seriesRef.current.createPriceLine({
            price,
            color: "#22d3ee",
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "🔔 S/R",
          });
          setLineas((prev) => [
            ...prev,
            {
              localId: nextLocalId.current++,
              price,
              priceLine,
              alertId: a.id,
              guardando: false,
            },
          ]);
        });
      })
      .catch(() => {});
    // Solo queremos que corra una vez por cada gráfico nuevo (cuando cambian las velas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, isPro, proEmail, coin]);

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
    setLineas([]);

    // Al hacer clic en el gráfico (con el modo "marcar" activado), dibujamos
    // una línea horizontal de soporte/resistencia en el precio donde se hizo clic.
    const handleClick = (param: MouseEventParams) => {
      if (!drawModeRef.current) return;
      if (!param.point || !seriesRef.current) return;

      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (price === null) return;

      const priceLine = seriesRef.current.createPriceLine({
        price,
        color: "#eab308",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "S/R",
      });

      setLineas((prev) => [
        ...prev,
        { localId: nextLocalId.current++, price, priceLine, alertId: null, guardando: false },
      ]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  const borrarLinea = useCallback(
    async (linea: LineaMarcada) => {
      seriesRef.current?.removePriceLine(linea.priceLine);
      setLineas((prev) => prev.filter((l) => l.localId !== linea.localId));
      if (linea.alertId) {
        try {
          await fetch(`/api/alerts?id=${linea.alertId}`, { method: "DELETE" });
        } catch {
          // si falla el borrado en el servidor no es grave, la línea ya
          // desapareció del gráfico para el usuario
        }
      }
    },
    []
  );

  const borrarTodasLasLineas = () => {
    lineas.forEach((l) => borrarLinea(l));
  };

  // Activa el aviso push para una línea: pide permiso de notificaciones,
  // suscribe el navegador y guarda el aviso en el servidor.
  const activarAviso = async (linea: LineaMarcada) => {
    if (!isPro) {
      setAvisoMensaje("Los avisos de precio son una función del Plan Pro.");
      setTimeout(() => setAvisoMensaje(null), 4000);
      return;
    }
    if (!proEmail) {
      setAvisoMensaje("No encontramos tu correo del Plan Pro. Vuelve a entrar desde el panel.");
      setTimeout(() => setAvisoMensaje(null), 4000);
      return;
    }

    setLineas((prev) =>
      prev.map((l) => (l.localId === linea.localId ? { ...l, guardando: true } : l))
    );

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Este navegador no soporta notificaciones push");
      }

      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        throw new Error("No diste permiso de notificaciones");
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("Falta configurar las notificaciones en el servidor");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: proEmail,
          coin,
          price: linea.price,
          subscription: subscription.toJSON(),
        }),
      });

      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes.error || "No se pudo activar el aviso");

      setLineas((prev) =>
        prev.map((l) =>
          l.localId === linea.localId
            ? { ...l, alertId: dataRes.alert.id, guardando: false }
            : l
        )
      );
    } catch (err) {
      setLineas((prev) =>
        prev.map((l) => (l.localId === linea.localId ? { ...l, guardando: false } : l))
      );
      const mensaje = err instanceof Error ? err.message : "No se pudo activar el aviso";
      setAvisoMensaje(mensaje);
      setTimeout(() => setAvisoMensaje(null), 4000);
    }
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
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-2 max-w-[280px]">
        <div className="flex flex-wrap gap-2">
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
          {lineas.length > 0 && (
            <button
              onClick={borrarTodasLasLineas}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 text-slate-300 border border-slate-700 hover:bg-slate-800 transition"
            >
              🗑️ Borrar líneas ({lineas.length})
            </button>
          )}
        </div>

        {lineas.length > 0 && (
          <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-2 flex flex-col gap-1.5">
            {lineas.map((linea) => (
              <div key={linea.localId} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-slate-300">
                  ${linea.price.toLocaleString("es", { maximumFractionDigits: 2 })}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => activarAviso(linea)}
                    disabled={linea.guardando || !!linea.alertId}
                    title={
                      linea.alertId
                        ? "Te avisaremos cuando el precio llegue aquí"
                        : "Avisarme cuando el precio llegue aquí"
                    }
                    className={`px-1.5 py-0.5 rounded transition ${
                      linea.alertId
                        ? "text-cyan-400"
                        : "text-slate-400 hover:text-yellow-400"
                    }`}
                  >
                    {linea.guardando ? "…" : linea.alertId ? "🔔" : "🔕"}
                  </button>
                  <button
                    onClick={() => borrarLinea(linea)}
                    className="text-slate-500 hover:text-red-400 transition px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {avisoMensaje && (
          <div className="bg-slate-900 border border-yellow-700/50 text-yellow-300 text-xs rounded-lg px-2.5 py-1.5 max-w-[260px]">
            {avisoMensaje}
          </div>
        )}
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
