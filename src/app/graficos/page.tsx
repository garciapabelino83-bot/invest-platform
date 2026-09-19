"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import CandleChart from "@/components/CandleChart";

// Monedas de acceso rápido (las más conocidas), siempre visibles arriba de
// una vez. El resto de las monedas (memecoins, altcoins, lo que sea que
// tenga Binance) se buscan con el buscador de abajo — ver /api/coins.
const FAVORITOS = [
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

function etiqueta(symbol: string) {
  const nombre = NOMBRES[symbol];
  return nombre ? `${nombre} (${symbol})` : symbol;
}

const TIMEFRAMES = [
  { id: "1s", label: "1 seg" },
  { id: "1m", label: "1 min" },
  { id: "5m", label: "5 min" },
  { id: "15m", label: "15 min" },
  { id: "30m", label: "30 min" },
  { id: "1h", label: "1 hora" },
  { id: "4h", label: "4 horas" },
  { id: "1d", label: "1 día" },
  { id: "1w", label: "1 semana" },
  { id: "1M", label: "1 mes" },
  { id: "1A", label: "1 año" },
];

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

const PRO_EMAIL_KEY = "invest-pro-email";

export default function Graficos() {
  const [coin, setCoin] = useState("BTC");
  const [timeframe, setTimeframe] = useState("1d");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Lista completa de monedas (para el buscador) ---
  const [todasLasMonedas, setTodasLasMonedas] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");

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

  useEffect(() => {
    setLoading(true);
    fetch(`/api/candles?coin=${coin}&tf=${timeframe}`)
      .then((res) => res.json())
      .then((data) => {
        setCandles(data.candles || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [coin, timeframe]);

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
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📊 InvestPanel</h1>
            <p className="text-slate-400 text-sm">Gráficos de velas en tiempo real</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Link href="/ayuda" className="text-sm text-slate-400 hover:text-white transition">
              📚 Guía rápida
            </Link>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">
              ← Volver al panel
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6 w-full flex-1 flex flex-col">
        <div className="flex flex-wrap gap-2 mb-3">
          {FAVORITOS.map((c) => (
            <button
              key={c.id}
              onClick={() => elegirMoneda(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                coin === c.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mb-4 relative max-w-sm">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={
              todasLasMonedas.length > 0
                ? `Buscar entre ${todasLasMonedas.length} monedas más (ej. PEPE, SHIB, ARB)...`
                : "Cargando el resto de las monedas..."
            }
            className="w-full px-3 py-2 rounded-lg text-sm bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-600"
          />

          {busqueda && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-wrap gap-1.5 shadow-xl">
              {resultadosBusqueda.length === 0 ? (
                <p className="text-xs text-slate-500 px-1 py-1">
                  No encontramos ninguna moneda con &quot;{busqueda}&quot;.
                </p>
              ) : (
                resultadosBusqueda.map((s) => (
                  <button
                    key={s}
                    onClick={() => elegirMoneda(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      coin === s
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {etiqueta(s)}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                timeframe === tf.id
                  ? "bg-slate-700 text-white border border-slate-600"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-3">{etiqueta(coin)}</h2>

        {!isPro && (
          <p className="text-xs text-slate-500 mb-3">
            🔔 Recibir un aviso cuando el precio llegue a una línea que marques es una función
            del{" "}
            <Link href="/" className="text-blue-400 hover:underline">
              Plan Pro
            </Link>
            .
          </p>
        )}

        <div className="bg-slate-900 rounded-2xl border border-slate-800 h-[600px] p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Cargando velas...
            </div>
          ) : (
            <CandleChart candles={candles} coin={coin} isPro={isPro} proEmail={proEmail} />
          )}
        </div>

        <p className="text-slate-600 text-xs mt-4 text-center">
          Datos de mercado en tiempo real. Esto no es asesoría financiera.
          {" "}Gráficos con tecnología de{" "}
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-400"
          >
            Lightweight Charts (TradingView)
          </a>
          .
        </p>
      </div>
    </main>
  );
}
