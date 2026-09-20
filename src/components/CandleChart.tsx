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

const VERDE = "#0ecb81";
const ROJO = "#f6465d";

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

// --- Iconos (inline, sin dependencias) ---
function IconCursor() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M3 2L13.5 7.2 8.6 8.6 7.2 13.5 3 2z" fill="currentColor" />
    </svg>
  );
}
function IconLine() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="3.5" cy="12.5" r="1.6" fill="currentColor" />
      <circle cx="12.5" cy="3.5" r="1.6" fill="currentColor" />
      <path d="M4.7 11.3L11.3 4.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconSliders() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5h7M11.5 4.5H14M2 11.5h3M6.5 11.5H14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="4.5" r="1.6" fill="currentColor" />
      <circle cx="4.5" cy="11.5" r="1.6" fill="currentColor" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 4.5h10M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M4.5 4.5l.6 8a1 1 0 001 .9h3.8a1 1 0 001-.9l.6-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RailBtn({
  activo,
  onClick,
  title,
  children,
}: {
  activo?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
        activo
          ? "bg-white text-black"
          : "text-neutral-400 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
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
      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
        activo
          ? "bg-white text-black"
          : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function CandleChart({
  candles,
  coin,
  timeframe,
  isPro,
  proEmail,
  sufijo = "USDT",
}: {
  candles: Candle[];
  coin: string;
  timeframe: string;
  isPro: boolean;
  proEmail: string | null;
  // Se muestra como "{coin}/{sufijo}" en la leyenda del gráfico — "USDT"
  // para cripto, la moneda de cotización ("USD", "EUR"...) para acciones e
  // índices, o "" para no mostrar ninguna barra.
  sufijo?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const drawModeRef = useRef(false);
  const nextLocalId = useRef(1);
  const lineasRef = useRef<LineaMarcada[]>([]);
  const prevCandlesRef = useRef<Candle[] | null>(null);
  const indicadoresRef = useRef<HTMLDivElement>(null);

  const [drawMode, setDrawMode] = useState(false);
  const [lineas, setLineas] = useState<LineaMarcada[]>([]);
  const [avisoMensaje, setAvisoMensaje] = useState<string | null>(null);
  const [indicadoresAbiertos, setIndicadoresAbiertos] = useState(false);

  // Leyenda OHLC arriba a la izquierda del gráfico (como en los exchanges):
  // sigue al cursor, y si no hay cursor sobre el gráfico muestra la última vela.
  const [legendCandle, setLegendCandle] = useState<Candle | null>(null);

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

  // Cerrar el panel de indicadores al hacer clic fuera de él
  useEffect(() => {
    if (!indicadoresAbiertos) return;
    const cerrar = (e: MouseEvent) => {
      if (indicadoresRef.current && !indicadoresRef.current.contains(e.target as Node)) {
        setIndicadoresAbiertos(false);
      }
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [indicadoresAbiertos]);

  // La vela que se muestra en la leyenda por defecto es la última, hasta que
  // el usuario pase el cursor sobre otra parte del gráfico.
  useEffect(() => {
    setLegendCandle(candles.length > 0 ? candles[candles.length - 1] : null);
  }, [candles]);

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
        textColor: "#6b7280",
        // Quitamos el logo de atribución de la librería: ya damos crédito
        // por escrito más abajo en la página, como permite su licencia.
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#161618" },
        horzLines: { color: "#161618" },
      },
      crosshair: {
        vertLine: { color: "#3f3f46", labelBackgroundColor: "#27272a" },
        horzLine: { color: "#3f3f46", labelBackgroundColor: "#27272a" },
      },
      width,
      height,
      timeScale: { borderColor: "#1f1f23", timeVisible: true, secondsVisible: true },
      rightPriceScale: {
        borderColor: "#1f1f23",
        scaleMargins: hayPanelMomento
          ? { top: 0.05, bottom: volumeOn ? 0.45 : 0.3 }
          : { top: 0.05, bottom: volumeOn ? 0.2 : 0.05 },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: VERDE,
      downColor: ROJO,
      borderVisible: false,
      wickUpColor: VERDE,
      wickDownColor: ROJO,
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
        color: "#f0b90b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma7.setData(sma(candles, 7).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

      const ma30 = chart.addLineSeries({
        color: "#ec4899",
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
        color: "#52525b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bUp.setData(upper.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

      const bLow = chart.addLineSeries({
        color: "#52525b",
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
          color: c.close >= c.open ? "rgba(14,203,129,0.5)" : "rgba(246,70,93,0.5)",
        }))
      );
    }

    // --- Panel de momento: RSI, MACD, KDJ o WR (uno a la vez) ---
    if (momentoTipo === "rsi") {
      const rsiSeries = chart.addLineSeries({
        color: "#f0b90b",
        lineWidth: 2,
        priceScaleId: "momento",
        priceLineVisible: false,
        lastValueVisible: true,
      });
      chart.priceScale("momento").applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
      rsiSeries.setData(rsi(candles, 14).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      rsiSeries.createPriceLine({ price: 70, color: "#3f3f46", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
      rsiSeries.createPriceLine({ price: 30, color: "#3f3f46", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
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
          color: p.value >= 0 ? "rgba(14,203,129,0.6)" : "rgba(246,70,93,0.6)",
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
        color: "#f0b90b",
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
        color: "#f0b90b",
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
      wrSeries.createPriceLine({ price: -20, color: "#3f3f46", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
      wrSeries.createPriceLine({ price: -80, color: "#3f3f46", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
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
          color: linea.alertId ? "#22d3ee" : "#f0b90b",
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
        color: "#f0b90b",
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

    // Leyenda OHLC que sigue al cursor (como en los exchanges): al pasar el
    // mouse por el gráfico mostramos la vela bajo el cursor; al salir,
    // volvemos a mostrar la última vela.
    const handleCrosshair = (param: MouseEventParams) => {
      if (!param.time || !seriesRef.current) {
        setLegendCandle(candles.length > 0 ? candles[candles.length - 1] : null);
        return;
      }
      const d = param.seriesData.get(seriesRef.current) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (d && typeof d.open === "number") {
        setLegendCandle({ time: (param.time as number) || 0, open: d.open, high: d.high, low: d.low, close: d.close });
      }
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    const handleResize = () => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.unsubscribeClick(handleClick);
      chart.unsubscribeCrosshairMove(handleCrosshair);
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
      <div className="w-full h-full flex items-center justify-center text-neutral-600 text-sm">
        Cargando velas...
      </div>
    );
  }

  const cambio = legendCandle ? legendCandle.close - legendCandle.open : 0;
  const cambioPct = legendCandle && legendCandle.open !== 0 ? (cambio / legendCandle.open) * 100 : 0;
  const subiendo = cambio >= 0;

  return (
    <div className="relative w-full h-full flex">
      {/* --- Riel vertical de herramientas (estilo exchange) --- */}
      <div className="flex flex-col items-center gap-1 pr-2 pt-1 border-r border-white/10 mr-2">
        <RailBtn activo={!drawMode} onClick={() => setDrawMode(false)} title="Cursor">
          <IconCursor />
        </RailBtn>
        <RailBtn activo={drawMode} onClick={() => setDrawMode((v) => !v)} title="Marcar soporte/resistencia">
          <IconLine />
        </RailBtn>

        <div className="relative" ref={indicadoresRef}>
          <RailBtn activo={indicadoresAbiertos} onClick={() => setIndicadoresAbiertos((v) => !v)} title="Indicadores">
            <IconSliders />
          </RailBtn>

          {indicadoresAbiertos && (
            <div className="absolute z-20 left-10 top-0 w-56 bg-[#111113] border border-white/10 rounded-xl shadow-2xl p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-600 mb-1.5">Sobre el precio</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
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
              <p className="text-[10px] uppercase tracking-wide text-neutral-600 mb-1.5">Momento</p>
              <div className="flex flex-wrap gap-1.5">
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
          )}
        </div>

        {lineas.length > 0 && (
          <RailBtn onClick={borrarTodasLasLineas} title={`Borrar todas las líneas (${lineas.length})`}>
            <IconTrash />
          </RailBtn>
        )}
      </div>

      {/* --- Área del gráfico --- */}
      <div className="relative flex-1 min-w-0">
        {/* Leyenda estilo exchange: símbolo/temporalidad y OHLC en vivo */}
        <div className="absolute top-1 left-2 z-10 pointer-events-none select-none">
          <p className="text-[11px] font-semibold text-neutral-400">
            {coin}
            {sufijo ? `/${sufijo}` : ""} · {timeframe} · InvestPanel
          </p>
          {legendCandle && (
            <p className={`text-[11px] font-mono ${subiendo ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
              O{legendCandle.open.toLocaleString("en-US", { maximumFractionDigits: 4 })}{" "}
              H{legendCandle.high.toLocaleString("en-US", { maximumFractionDigits: 4 })}{" "}
              L{legendCandle.low.toLocaleString("en-US", { maximumFractionDigits: 4 })}{" "}
              C{legendCandle.close.toLocaleString("en-US", { maximumFractionDigits: 4 })}{" "}
              {subiendo ? "+" : ""}
              {cambio.toLocaleString("en-US", { maximumFractionDigits: 4 })} ({subiendo ? "+" : ""}
              {cambioPct.toFixed(2)}%)
            </p>
          )}
        </div>

        {lineas.length > 0 && (
          <div className="absolute top-1 right-2 z-10 bg-[#111113]/95 border border-white/10 rounded-lg p-2 flex flex-col gap-1.5 max-w-[220px]">
            {lineas.map((linea) => (
              <div key={linea.localId} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-neutral-300">
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
                      linea.alertId ? "text-cyan-400" : "text-neutral-500 hover:text-[#f0b90b]"
                    }`}
                  >
                    {linea.guardando ? "…" : linea.alertId ? "🔔" : "🔕"}
                  </button>
                  <button
                    onClick={() => borrarLinea(linea)}
                    className="text-neutral-600 hover:text-[#f6465d] transition px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {avisoMensaje && (
          <div className="absolute bottom-2 left-2 z-10 bg-[#111113] border border-[#f0b90b]/40 text-[#f0b90b] text-xs rounded-lg px-2.5 py-1.5 max-w-[260px]">
            {avisoMensaje}
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
