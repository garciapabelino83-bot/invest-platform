"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import CandleChart from "@/components/CandleChart";
import AssetIcon, { TipoActivo } from "@/components/AssetIcon";

// Monedas de acceso rápido (las más conocidas), siempre visibles arriba de
// una vez. El resto de las monedas (memecoins, altcoins, lo que sea que
// tenga Binance) se buscan con el buscador de abajo — ver /api/coins.
const FAVORITOS_CRIPTO = [
  { id: "BTC", label: "Bitcoin (BTC)" },
  { id: "ETH", label: "Ethereum (ETH)" },
  { id: "SOL", label: "Solana (SOL)" },
  { id: "ADA", label: "Cardano (ADA)" },
  { id: "XRP", label: "XRP" },
  { id: "DOGE", label: "Dogecoin (DOGE)" },
  { id: "DOT", label: "Polkadot (DOT)" },
  { id: "AVAX", label: "Avalanche (AVAX)" },
  { id: "LINK", label: "Chainlink (LINK)" },
  { id: "LTC", label: "Litecoin (LTC)" },
];

// Índices bursátiles principales + algunas acciones muy conocidas, con el
// símbolo tal como lo usa Yahoo Finance (fuente de los datos de esta
// sección — ver /api/stock-candles y /api/stock-ticker). No hay un buscador
// con lista completa como en cripto: para cualquier otro símbolo, se puede
// escribir directo (ver más abajo).
const FAVORITOS_MERCADOS = [
  { id: "^GSPC", label: "S&P 500" },
  { id: "^DJI", label: "Dow Jones" },
  { id: "^IXIC", label: "Nasdaq Composite" },
  { id: "^IBEX", label: "IBEX 35" },
  { id: "^GDAXI", label: "DAX" },
  { id: "^FCHI", label: "CAC 40" },
  { id: "^FTSE", label: "FTSE 100" },
  { id: "^N225", label: "Nikkei 225" },
  { id: "^HSI", label: "Hang Seng" },
  { id: "000001.SS", label: "SSE Composite" },
  { id: "^BVSP", label: "Bovespa" },
  { id: "AAPL", label: "Apple (AAPL)" },
  { id: "MSFT", label: "Microsoft (MSFT)" },
  { id: "GOOGL", label: "Alphabet (GOOGL)" },
  { id: "AMZN", label: "Amazon (AMZN)" },
  { id: "NVDA", label: "Nvidia (NVDA)" },
  { id: "TSLA", label: "Tesla (TSLA)" },
];

// Nombres más conocidos, solo para mostrar algo más amigable que el
// símbolo solo cuando lo tenemos a mano. El resto de las +200 monedas
// disponibles se muestran con su símbolo, igual que en cualquier exchange.
const NOMBRES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  ADA: "Cardano",
  XRP: "XRP",
  DOGE: "Dogecoin",
  DOT: "Polkadot",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  LTC: "Litecoin",
  BNB: "BNB",
  TRX: "TRON",
  TON: "Toncoin",
  SHIB: "Shiba Inu",
  PEPE: "Pepe",
  FLOKI: "Floki",
  BONK: "Bonk",
  WIF: "dogwifhat",
  MATIC: "Polygon",
  POL: "Polygon",
  ATOM: "Cosmos",
  NEAR: "NEAR Protocol",
  ARB: "Arbitrum",
  OP: "Optimism",
  SUI: "Sui",
  APT: "Aptos",
  INJ: "Injective",
  UNI: "Uniswap",
  AAVE: "Aave",
  SAND: "The Sandbox",
  MANA: "Decentraland",
  FTM: "Fantom",
  ALGO: "Algorand",
  VET: "VeChain",
  ICP: "Internet Computer",
  FIL: "Filecoin",
  HBAR: "Hedera",
  XLM: "Stellar",
  ETC: "Ethereum Classic",
  BCH: "Bitcoin Cash",
  EOS: "EOS",
  GRT: "The Graph",
  LDO: "Lido DAO",
  RUNE: "THORChain",
  PENGU: "Pudgy Penguins",
  TIA: "Celestia",
  SEI: "Sei",
  ORDI: "ORDI",
  WLD: "Worldcoin",
};

function etiquetaMercado(symbol: string) {
  const fav = FAVORITOS_MERCADOS.find((f) => f.id === symbol);
  return fav ? fav.label : symbol;
}

// Para elegir el logo correcto: los índices bursátiles empiezan con "^" o
// son un código numérico de bolsa (ej. "000001.SS", la de Shanghai) y no
// tienen un logo de empresa como sí lo tiene una acción.
function tipoDeSimboloMercado(id: string): "accion" | "indice" {
  return id.startsWith("^") || /^[0-9]/.test(id) ? "indice" : "accion";
}

const CATEGORIAS: { id: "todos" | "cripto" | "acciones" | "indices"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "cripto", label: "Cripto" },
  { id: "acciones", label: "Acciones" },
  { id: "indices", label: "Índices" },
];

type Fila = {
  key: string;
  simbolo: string;
  nombre: string;
  tipoDato: "cripto" | "mercado";
  tipoIcono: TipoActivo;
  tag: string;
};

const TIMEFRAMES = [
  { id: "1s", label: "1s" },
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "30m", label: "30m" },
  { id: "1h", label: "1h" },
  { id: "4h", label: "4h" },
  { id: "1d", label: "1d" },
  { id: "1w", label: "1s" },
  { id: "1M", label: "1M" },
  { id: "1A", label: "1A" },
];

// Temporalidades con sentido para acciones/índices (no cotizan 24/7, así
// que "1 segundo" y "1 minuto" casi no aportan con datos que se actualizan
// cada tanto).
const TIMEFRAMES_MERCADOS = TIMEFRAMES.filter((tf) => !["1s"].includes(tf.id));

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type TickerUnificado = {
  lastPrice: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume?: number; // solo cripto (volumen en USDT)
  moneda?: string; // solo acciones/índices (USD, EUR, JPY...)
};

const PRO_EMAIL_KEY = "invest-pro-email";

// Formato de precio adaptativo: monedas caras (BTC) con 2 decimales,
// monedas baratas (PEPE, SHIB) con más decimales para que no se vean como 0.
function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1) {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (value === 0) return "0.00";
  const decimales = value >= 0.01 ? 4 : value >= 0.0001 ? 6 : 8;
  return value.toLocaleString("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

type Modo = "cripto" | "mercados";

export default function Graficos() {
  const [modo, setModo] = useState<Modo>("cripto");
  const [coin, setCoin] = useState("BTC");
  const [symbol, setSymbol] = useState("^GSPC");
  const [timeframe, setTimeframe] = useState("1d");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState<TickerUnificado | null>(null);

  const activo = modo === "cripto" ? coin : symbol;

  // --- Lista completa de monedas (para el buscador de cripto) ---
  const [todasLasMonedas, setTodasLasMonedas] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<"todos" | "cripto" | "acciones" | "indices">("todos");
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const buscadorRef = useRef<HTMLDivElement>(null);

  // --- Plan Pro (para saber si puede activar avisos de precio) ---
  const [proEmail, setProEmail] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const email = localStorage.getItem(PRO_EMAIL_KEY);
    if (email) setProEmail(email);
  }, []);

  useEffect(() => {
    if (!proEmail) return;
    fetch(`/api/subscription-status?email=${encodeURIComponent(proEmail)}`)
      .then((res) => res.json())
      .then((data) => setIsPro(!!data.isPro))
      .catch(() => {});
  }, [proEmail]);

  useEffect(() => {
    fetch("/api/coins")
      .then((res) => res.json())
      .then((data) => setTodasLasMonedas(data.coins || []))
      .catch(() => {});
  }, []);

  // Al cambiar de modo, usamos una temporalidad válida para ese modo (1s
  // solo existe para cripto).
  useEffect(() => {
    if (modo === "mercados" && timeframe === "1s") {
      setTimeframe("1d");
    }
  }, [modo, timeframe]);

  useEffect(() => {
    setLoading(true);
    const url =
      modo === "cripto"
        ? `/api/candles?coin=${coin}&tf=${timeframe}`
        : `/api/stock-candles?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setCandles(data.candles || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [modo, coin, symbol, timeframe]);

  // Barra de precio estilo exchange (cambio %, máximo, mínimo, volumen).
  // Se actualiza sola cada 10s, independiente de las velas del gráfico y
  // de la temporalidad elegida.
  useEffect(() => {
    let cancelado = false;
    const cargarTicker = () => {
      const url =
        modo === "cripto"
          ? `/api/ticker24h?coin=${coin}`
          : `/api/stock-ticker?symbol=${encodeURIComponent(symbol)}`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (cancelado || data.error) return;
          setTicker(data);
        })
        .catch(() => {});
    };
    cargarTicker();
    const intervalo = setInterval(cargarTicker, 10000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [modo, coin, symbol]);

  useEffect(() => {
    const cerrarSiClicFuera = (e: MouseEvent) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target as Node)) {
        setBuscadorAbierto(false);
      }
    };
    document.addEventListener("mousedown", cerrarSiClicFuera);
    return () => document.removeEventListener("mousedown", cerrarSiClicFuera);
  }, []);

  const resultadosBusqueda = useMemo(() => {
    const texto = busqueda.trim().toUpperCase();
    if (!texto) return [];
    return todasLasMonedas
      .filter((s) => s.includes(texto) || (NOMBRES[s] || "").toUpperCase().includes(texto))
      .slice(0, 48);
  }, [busqueda, todasLasMonedas]);

  const elegirMoneda = (id: string) => {
    setCoin(id);
    setBusqueda("");
    setBuscadorAbierto(false);
    setTicker(null);
  };

  const elegirSimbolo = (id: string) => {
    setSymbol(id.toUpperCase());
    setBusqueda("");
    setBuscadorAbierto(false);
    setTicker(null);
  };

  // --- Buscador unificado (estilo TradingView): cripto + acciones/índices
  // en una sola lista, con logos y categorías, en vez de dos listas
  // separadas según el modo en el que estuviéramos antes de abrirlo.
  const filasCripto: Fila[] = useMemo(() => {
    const lista = busqueda.trim() ? resultadosBusqueda : FAVORITOS_CRIPTO.map((f) => f.id);
    return lista.map((s) => ({
      key: `c-${s}`,
      simbolo: s,
      nombre: NOMBRES[s] || s,
      tipoDato: "cripto",
      tipoIcono: "cripto",
      tag: "Cripto · Binance",
    }));
  }, [busqueda, resultadosBusqueda]);

  const filasMercados: Fila[] = useMemo(() => {
    const texto = busqueda.trim().toUpperCase();
    const base = texto
      ? FAVORITOS_MERCADOS.filter(
          (f) => f.id.toUpperCase().includes(texto) || f.label.toUpperCase().includes(texto)
        )
      : FAVORITOS_MERCADOS;
    return base.map((f) => {
      const tipoIcono = tipoDeSimboloMercado(f.id);
      return {
        key: `m-${f.id}`,
        simbolo: f.id,
        nombre: f.label,
        tipoDato: "mercado",
        tipoIcono,
        tag: tipoIcono === "indice" ? "Índice" : "Acción",
      };
    });
  }, [busqueda]);

  const filasVisibles: Fila[] = useMemo(() => {
    if (categoria === "cripto") return filasCripto;
    if (categoria === "acciones") return filasMercados.filter((f) => f.tipoIcono === "accion");
    if (categoria === "indices") return filasMercados.filter((f) => f.tipoIcono === "indice");
    return [...filasCripto, ...filasMercados];
  }, [categoria, filasCripto, filasMercados]);

  const textoBusquedaLimpio = busqueda.trim().toUpperCase();
  const hayCoincidenciaExacta = filasMercados.some((f) => f.simbolo.toUpperCase() === textoBusquedaLimpio);
  const mostrarBusquedaManual = textoBusquedaLimpio.length > 0 && !hayCoincidenciaExacta && categoria !== "cripto";

  const elegirActivo = (fila: Fila) => {
    if (fila.tipoDato === "cripto") {
      setModo("cripto");
      elegirMoneda(fila.simbolo);
    } else {
      setModo("mercados");
      elegirSimbolo(fila.simbolo);
    }
  };

  const buscarSimboloExacto = () => {
    setModo("mercados");
    elegirSimbolo(busqueda.trim());
  };

  const subiendo = (ticker?.changePercent ?? 0) >= 0;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-3.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">InvestPanel</h1>
            <p className="text-neutral-500 text-[11px]">Gráficos de velas en tiempo real</p>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <Link href="/ayuda" className="text-xs text-neutral-400 hover:text-white transition">
              Guía rápida
            </Link>
            <Link href="/herramientas" className="text-xs text-neutral-400 hover:text-white transition">
              🧮 Herramientas
            </Link>
            <Link href="/" className="text-xs text-neutral-400 hover:text-white transition">
              ← Volver al panel
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-5 w-full flex-1 flex flex-col">
        {/* --- Cripto / Acciones e índices --- */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setModo("cripto")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
              modo === "cripto" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
            }`}
          >
            Cripto
          </button>
          <button
            onClick={() => setModo("mercados")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
              modo === "mercados" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
            }`}
          >
            Acciones e índices
          </button>
        </div>

        {/* --- Barra de precio estilo exchange --- */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pb-4 mb-4 border-b border-white/10">
          <div className="relative" ref={buscadorRef}>
            <button
              onClick={() => setBuscadorAbierto((v) => !v)}
              className="flex items-center gap-2 group"
            >
              <AssetIcon
                symbol={activo}
                tipo={modo === "cripto" ? "cripto" : tipoDeSimboloMercado(activo)}
                size={28}
              />
              <span className="text-lg font-bold tracking-tight">
                {modo === "cripto" ? (
                  <>
                    {coin}
                    <span className="text-neutral-500">/USDT</span>
                  </>
                ) : (
                  etiquetaMercado(symbol)
                )}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={`text-neutral-500 group-hover:text-neutral-300 transition ${buscadorAbierto ? "rotate-180" : ""}`}
              >
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {buscadorAbierto && (
              <div
                className="fixed inset-0 z-40 bg-black/70 flex items-start justify-center pt-24 px-4"
                onClick={() => setBuscadorAbierto(false)}
              >
                <div
                  className="w-full max-w-xl bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-3 border-b border-white/10 shrink-0">
                    <div className="relative">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                      >
                        <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <input
                        autoFocus
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar símbolo, cripto o acción (BTC, AAPL, PEPE, ^IBEX...)"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-black border border-white/10 text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                      />
                    </div>

                    <div className="flex gap-1 mt-3 flex-wrap">
                      {CATEGORIAS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCategoria(c.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            categoria === c.id
                              ? "bg-white text-black"
                              : "text-neutral-400 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-y-auto p-2">
                    {filasVisibles.length === 0 && !mostrarBusquedaManual ? (
                      <p className="text-xs text-neutral-600 px-3 py-8 text-center">
                        No encontramos nada con &quot;{busqueda}&quot;.
                      </p>
                    ) : (
                      <>
                        {filasVisibles.map((f) => {
                          const seleccionado =
                            f.tipoDato === "cripto"
                              ? modo === "cripto" && coin === f.simbolo
                              : modo === "mercados" && symbol === f.simbolo;
                          return (
                            <button
                              key={f.key}
                              onClick={() => elegirActivo(f)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                                seleccionado ? "bg-white/10" : "hover:bg-white/5"
                              }`}
                            >
                              <AssetIcon symbol={f.simbolo} tipo={f.tipoIcono} size={28} />
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-semibold text-white truncate">
                                  {f.simbolo.replace(/^\^/, "")}
                                </span>
                                <span className="block text-[11px] text-neutral-500 truncate">{f.nombre}</span>
                              </span>
                              <span className="text-[10px] text-neutral-600 uppercase tracking-wide shrink-0">
                                {f.tag}
                              </span>
                            </button>
                          );
                        })}

                        {mostrarBusquedaManual && (
                          <button
                            onClick={buscarSimboloExacto}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left border border-dashed border-white/15 hover:bg-white/5 transition mt-1"
                          >
                            <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-neutral-400 text-xs">
                              🔎
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-semibold text-white">
                                Buscar &quot;{textoBusquedaLimpio}&quot; en acciones e índices
                              </span>
                              <span className="block text-[11px] text-neutral-500">
                                Si sabes el símbolo exacto (ej. AAPL, ^IBEX)
                              </span>
                            </span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {ticker ? (
            <>
              <div className="flex flex-col leading-tight">
                <span className={`text-2xl font-bold tabular-nums ${subiendo ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                  {formatPrice(ticker.lastPrice)}
                </span>
                <span className="text-[11px] text-neutral-500">
                  {modo === "cripto" ? "USDT" : ticker.moneda || ""}
                </span>
              </div>

              <StatTile
                label={modo === "cripto" ? "Cambio 24h" : "Cambio"}
                value={`${subiendo ? "+" : ""}${ticker.changePercent.toFixed(2)}%`}
                colorClass={subiendo ? "text-[#0ecb81]" : "text-[#f6465d]"}
              />
              <StatTile label={modo === "cripto" ? "Máximo 24h" : "Máximo del día"} value={formatPrice(ticker.high)} />
              <StatTile label={modo === "cripto" ? "Mínimo 24h" : "Mínimo del día"} value={formatPrice(ticker.low)} />
              {modo === "cripto" ? (
                <>
                  <StatTile label="Volumen 24h" value={`${formatCompact(ticker.volume)} ${coin}`} />
                  <StatTile label="Volumen 24h (USDT)" value={formatCompact(ticker.quoteVolume ?? 0)} />
                </>
              ) : (
                <StatTile label="Volumen" value={formatCompact(ticker.volume)} />
              )}
            </>
          ) : (
            <span className="text-sm text-neutral-600">Cargando precio...</span>
          )}
        </div>

        {/* --- Temporalidades --- */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          <span className="text-[11px] text-neutral-600 mr-2 uppercase tracking-wide">Intervalo</span>
          {(modo === "cripto" ? TIMEFRAMES : TIMEFRAMES_MERCADOS).map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                timeframe === tf.id
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {!isPro && (
          <p className="text-[11px] text-neutral-600 mb-3">
            🔔 Recibir un aviso cuando el precio llegue a una línea que marques es una función
            del{" "}
            <Link href="/" className="text-neutral-300 hover:underline">
              Plan Pro
            </Link>
            .
          </p>
        )}

        <div className="bg-[#0a0a0b] rounded-xl border border-white/10 h-[600px] p-3">
          {loading ? (
            <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
              Cargando velas...
            </div>
          ) : candles.length === 0 ? (
            <div className="h-full flex items-center justify-center text-neutral-600 text-sm text-center px-6">
              No encontramos datos para &quot;{activo}&quot;. Revisa el símbolo o prueba con otro.
            </div>
          ) : (
            <CandleChart
              candles={candles}
              coin={activo}
              timeframe={timeframe}
              isPro={isPro}
              proEmail={proEmail}
              sufijo={modo === "cripto" ? "USDT" : ticker?.moneda || ""}
            />
          )}
        </div>

        <p className="text-neutral-700 text-[11px] mt-4 text-center">
          Datos de mercado en tiempo real. Esto no es asesoría financiera.
          {" "}Gráficos con tecnología de{" "}
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-500"
          >
            Lightweight Charts (TradingView)
          </a>
          {modo === "mercados" && (
            <>
              {" "}y{" "}
              <a
                href="https://finance.yahoo.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-neutral-500"
              >
                Yahoo Finance
              </a>
            </>
          )}
          .
        </p>
      </div>
    </main>
  );
}

function StatTile({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[11px] text-neutral-500 whitespace-nowrap">{label}</span>
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${colorClass || "text-neutral-200"}`}>
        {value}
      </span>
    </div>
  );
}
