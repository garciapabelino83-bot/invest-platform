"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PriceChart from "@/components/PriceChart";

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

type PricePoint = { date: string; price: number };

export default function Graficos() {
  const [coin, setCoin] = useState("bitcoin");
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [rsi, setRsi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analysis?coin=${coin}`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history || []);
        setCurrentPrice(data.currentPrice ?? null);
        setRsi(data.rsi ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [coin]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📊 InvestPanel</h1>
            <p className="text-slate-400 text-sm">Gráficos en tiempo real</p>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition">
            ← Volver al panel
          </Link>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6 w-full flex-1 flex flex-col">
        <div className="flex flex-wrap gap-2 mb-4">
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

        <div className="flex items-baseline gap-4 mb-3">
          <h2 className="text-2xl font-bold">
            {COINS.find((c) => c.id === coin)?.label}
          </h2>
          {currentPrice && (
            <span className="text-xl font-mono text-slate-300">
              ${currentPrice.toLocaleString()}
            </span>
          )}
          {rsi !== null && (
            <span className="text-sm text-slate-500">RSI: {rsi}</span>
          )}
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 flex-1 min-h-[600px] p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Cargando gráfico...
            </div>
          ) : history.length > 0 ? (
            <PriceChart data={history} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              No hay datos disponibles
            </div>
          )}
        </div>

        <p className="text-slate-600 text-xs mt-4 text-center">
          Datos de mercado en tiempo real. Esto no es asesoría financiera.
        </p>
      </div>
    </main>
  );
}
