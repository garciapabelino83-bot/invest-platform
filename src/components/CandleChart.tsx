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
import { sma, ema, bollinger, rsi, macd, kdj, williamsR, Candle } from "@/lib/indicators";

type LineaMarcada = {
  localId: number;
  price: number;
  priceLine: IPriceLine;
  alertId: number | null; // id en la base de datos si ya tiene aviso activado
  guardando: boolean;
};

type MomentoTipo = "ninguno" | "rsi" | "macd" | "kdj" | "wr";

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

function ToggleBtn({
  activo,
  onClick,
  children,
  title,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
        activo
          ? "bg-blue-600 text-white border-blue-500"
          : "bg-slate-900/80 text-slate-400 border-slate-700 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
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
  const lineasRef = useRef<LineaMarcada[]>([]);
  const prevCandlesRef = useRef<Candle[] | null>(null);

  const [drawMode, setDrawMode] = useState(false);
  const [lineas, setLineas] = useState<LineaMarcada[]>([]);
  const [avisoMensaje, setAvisoMensaje] = useState<string | null>(null);

  // Indicadores encima del precio (se pueden combinar varios a la vez)
  const [maOn, setMaOn] = useState(false);
  const [emaOn, setEmaOn] = useState(false);
  const [bollOn, setBollOn] = useState(false);
  // Volumen: panel aparte, encendido por defecto como en la mayoría de plataformas
  const [volumeOn, setVolumeOn] = useState(true);
  // Panel de "momento": solo uno a la vez (RSI, MACD, KDJ o WR)
  const [momentoTipo, setMomentoTipo] = useState<MomentoTipo>("ninguno");

  useEffect(() => {
    lineasRef.current = lineas;
  }, [lineas]);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  // --- Construcción del gráfico ---
  // Este efecto reconstruye todo el gráfico cuando cambian las velas
  // (activo o temporalidad nueva) O cuando se prende/apaga un indicador.
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const el = containerRef.current;
    el.innerHTML = "";

    const esCambioDeActivo = candles !== prevCandlesRef.current;
    prevCandlesRef.current = candles;

    const width = el.clientWidth || 800;
    const height = el.clientHeight || 500;
    const hayPanelMomento = momentoTipo !== "ninguno";

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
      timeScale: { borderColor: "#1e293b", timeVisible: true, secondsVisible: true },
      rightPriceScale: {
        borderColor: "#1e293b",
        scaleMargins: hayPanelMomento
          ? { top: 0.05, bottom: volumeOn ? 0.45 : 0.3 }
          : { top: 0.05, bottom: volumeOn ? 0.2 : 0.05 },
      },
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

    // --- Medias móviles (MA) ---
    if (maOn) {
      const ma7 = chart.addLineSeries({
        color: "#f97316",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma7.setData(sma(candles, 7).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

      const ma30 = chart.addLineSeries({
        color: "#fdba74",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma30.setData(sma(candles, 30).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

    // --- Medias móviles exponenciales (EMA) ---
    if (emaOn) {
      const ema12 = chart.addLineSeries({
        color: "#a855f7",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema12.setData(ema(candles, 12).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

      const ema26 = chart.addLineSeries({
        color: "#d8b4fe",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema26.setData(ema(candles, 26).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

    // --- Bandas de Bollinger (BOLL) ---
    if (bollOn) {
      const { mid, upper, lower } = bollinger(candles, 20, 2);
      const bMid = chart.addLineSeries({
        color: "#38bdf8",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bMid.setData(mid.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

      const bUp = chart.addLineSeries({
        color: "#64748b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bUp.setData(upper.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

      const bLow = chart.addLineSeries({
        color: "#64748b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bLow.setData(lower.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

    // --- Volumen (panel aparte, abajo) ---
    if (volumeOn) {
      const volumeSeries = chart.addHistogramSeries({
        priceScaleId: "volumen",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("volumen").applyOptions({
        scaleMargins: hayPanelMomento ? { top: 0.7, bottom: 0.3 } : { top: 0.85, bottom: 0 },
      });
      volumeSeries.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume || 0,
          color: c.close >= c.open ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
        }))
      );
    }

    // --- Panel de momento: RSI, MACD, KDJ o WR (uno a la vez) ---
    if (momentoTipo === "rsi") {
      const rsiSeries = chart.addLineSeries({
        color: "#facc15",
        lineWidth: 2,
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: true,
      });
      chart.priceScale("momento").applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
      rsiSeries.setData(rsi(candles, 14).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      rsiSeries.createPriceLine({ price: 70, color: "#475569", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
      rsiSeries.createPriceLine({ price: 30, color: "#475569", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
    } else if (momentoTipo === "macd") {
      const { macdLine, signalLine, histogram } = macd(candles);
      const histSeries = chart.addHistogramSeries({
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("momento").applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
      histSeries.setData(
        histogram.map((p) => ({
          time: p.time as UTCTimestamp,
          value: p.value,
          color: p.value >= 0 ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)",
        }))
      );
      const macdSeries = chart.addLineSeries({
        color: "#38bdf8",
        lineWidth: 1,
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      macdSeries.setData(macdLine.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      const signalSeries = chart.addLineSeries({
        color: "#f97316",
        lineWidth: 1,
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      signalSeries.setData(signalLine.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    } else if (momentoTipo === "kdj") {
      const { kLine, dLine, jLine } = kdj(candles);
      const kSeries = chart.addLineSeries({
        color: "#38bdf8",
        lineWidth: 1,
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("momento").applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
      kSeries.setData(kLine.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      const dSeries = chart.addLineSeries({
        color: "#f97316",
        lineWidth: 1,
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      dSeries.setData(dLine.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      const jSeries = chart.addLineSeries({
        color: "#a855f7",
        lineWidth: 1,
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      jSeries.setData(jLine.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    } else if (momentoTipo === "wr") {
      const wrSeries = chart.addLineSeries({
        color: "#22d3ee",
        lineWidth: 2,
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: true,
      });
      chart.priceScale("momento").applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
      wrSeries.setData(williamsR(candles, 14).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      wrSeries.createPriceLine({ price: -20, color: "#475569", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
      wrSeries.createPriceLine({ price: -80, color: "#475569", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;
    seriesRef.current = series;

    // Si cambiamos de activo/temporalidad, las líneas marcadas ya no aplican
    // (son de otro gráfico). Si solo se prendió/apagó un indicador, volvemos
    // a dibujar las líneas que el usuario ya tenía marcadas.
    if (esCambioDeActivo) {
      setLineas([]);
    } else {
      lineasRef.current.forEach((linea) => {
        linea.priceLine = series.createPriceLine({
          price: linea.price,
          color: linea.alertId ? "#22d3ee" : "#eab308",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: linea.alertId ? "🔔 S/R" : "S/R",
        });
      });
    }

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
  }, [candles, maOn, emaOn, bollOn, volumeOn, momentoTipo]);

  // Cargar avisos ya guardados de este activo (para que sigan ahí cuando el
  // usuario vuelve a entrar). Corre después de construir el gráfico de arriba.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, isPro, proEmail, coin]);

  const borrarLinea = useCallback(async (linea: LineaMarcada) => {
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
  }, []);

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
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-2 max-w-[300px]">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setDrawMode((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
              drawMode
                ? "bg-yellow-500 text-slate-950 border-yellow-400"
                : "bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800"
            }`}
          >
            {drawMode ? "Haz clic para marcar ✓" : "✏️ Marcar S/R"}
          </button>
          {lineas.length > 0 && (
            <button
              onClick={borrarTodasLasLineas}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900/80 text-slate-300 border border-slate-700 hover:bg-slate-800 transition"
            >
              🗑️ Borrar ({lineas.length})
            </button>
          )}
        </div>

        <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-2 flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1">
            <ToggleBtn activo={maOn} onClick={() => setMaOn((v) => !v)} title="Media móvil simple (7 y 30)">
              MA
            </ToggleBtn>
            <ToggleBtn activo={emaOn} onClick={() => setEmaOn((v) => !v)} title="Media móvil exponencial (12 y 26)">
              EMA
            </ToggleBtn>
            <ToggleBtn activo={bollOn} onClick={() => setBollOn((v) => !v)} title="Bandas de Bollinger (20, 2)">
              BOLL
            </ToggleBtn>
            <ToggleBtn activo={volumeOn} onClick={() => setVolumeOn((v) => !v)} title="Volumen">
              VOL
            </ToggleBtn>
          </div>
          <div className="flex flex-wrap gap-1 border-t border-slate-800 pt-1.5">
            <ToggleBtn
              activo={momentoTipo === "rsi"}
              onClick={() => setMomentoTipo((t) => (t === "rsi" ? "ninguno" : "rsi"))}
              title="Índice de fuerza relativa (14)"
            >
              RSI
            </ToggleBtn>
            <ToggleBtn
              activo={momentoTipo === "macd"}
              onClick={() => setMomentoTipo((t) => (t === "macd" ? "ninguno" : "macd"))}
              title="MACD (12, 26, 9)"
            >
              MACD
            </ToggleBtn>
            <ToggleBtn
              activo={momentoTipo === "kdj"}
              onClick={() => setMomentoTipo((t) => (t === "kdj" ? "ninguno" : "kdj"))}
              title="KDJ (9, 3, 3)"
            >
              KDJ
            </ToggleBtn>
            <ToggleBtn
              activo={momentoTipo === "wr"}
              onClick={() => setMomentoTipo((t) => (t === "wr" ? "ninguno" : "wr"))}
              title="Williams %R (14)"
            >
              WR
            </ToggleBtn>
          </div>
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
                      linea.alertId ? "text-cyan-400" : "text-slate-400 hover:text-yellow-400"
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
