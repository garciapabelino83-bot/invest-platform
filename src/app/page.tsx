"use client";

import { useEffect, useState } from "react";

type PriceData = {
  [coin: string]: { usd: number; usd_24h_change: number };
};

const COIN_LABELS: Record<string, string> = {
  bitcoin: "Bitcoin (BTC)",
  ethereum: "Ethereum (ETH)",
  solana: "Solana (SOL)",
};

export default function Dashboard() {
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/prices")
      .then((res) => res.json())
      .then((data) => setPrices(data))
      .catch(() => setError(true));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-2">Mi Plataforma de Inversión</h1>
      <p className="text-slate-400 mb-8">Precios en tiempo real</p>

      {error && (
        <p className="text-red-400">No se pudieron cargar los precios.</p>
      )}

      {!prices && !error && (
        <p className="text-slate-400">Cargando precios...</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {prices &&
          Object.entries(prices).map(([coin, data]) => {
            const isUp = data.usd_24h_change >= 0;
            return (
              <div
                key={coin}
                className="bg-slate-900 rounded-xl p-6 border border-slate-800"
              >
                <p className="text-slate-400 text-sm">{COIN_LABELS[coin] ?? coin}</p>
                <p className="text-2xl font-bold mt-1">
                  ${data.usd.toLocaleString()}
                </p>
                <p className={isUp ? "text-green-400 mt-1" : "text-red-400 mt-1"}>
                  {isUp ? "▲" : "▼"} {data.usd_24h_change.toFixed(2)}%
                </p>
              </div>
            );
          })}
      </div>
    </main>
  );
}
