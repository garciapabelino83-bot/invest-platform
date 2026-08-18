"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CandleChart from "@/components/CandleChart";

const COINS = [
  { id: "bitcoin", label: "Bitcoin (BTC)" },
  { id: "ethereum", label: "Ethereum (ETH)" },
  { id: "solana", label: "Solana (SOL)" },
  { id: "cardano", label: "Cardano (ADA)" },
  { id: "ripple", label: "XRP" },
  { id: "dogecoin", label: "Dogecoin (DOGE)" },
  { id: "polkadot", label: "Polkadot (DOT)" },
  { id: "avalanche", label: "Avalanche (AVAX)" },
  { id: "chainlink", label: "Chainlink (LINK)" },
  { id: "litecoin", label: "Litecoin (LTC)" },
];

const TIMEFRAMES = [
  { id: "1h", label: "1 Hora" },
  { id: "4h", label: "4 Horas" },
  { id: "1d", label: "1 Día" },
];

type Candle = { time: number; open: number; high: number; low: number; close: number };

export default function Graficos() {
  const [coin, setCoin] = useState("bitcoin");
  const [timeframe, setTimeframe] = useState("1d");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📊 InvestPanel</h1>
            <p className="text-slate-400 text-sm">Gráficos de velas en tiempo real</p>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition">
            ← Volver al panel
          </Link>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6 w-full flex-1 flex flex-col">
        <div className="flex flex-wrap gap-2 mb-3">
          {COINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCoin(c.id)}
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

        <div className="flex gap-2 mb-4">
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

        <h2 className="text-2xl font-bold mb-3">
          {COINS.find((c) => c.id === coin)?.label}
        </h2>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 h-[600px] p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Cargando velas...
            </div>
          ) : (
            <CandleChart candles={candles} />
          )}
        </div>

        <p className="text-slate-600 text-xs mt-4 text-center">
          Datos de mercado en tiempo real. Esto no es asesoría financiera.
        </p>
      </div>
    </main>
  );
}
