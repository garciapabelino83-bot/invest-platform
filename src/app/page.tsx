"use client";

import { useEffect, useState } from "react";

type PriceData = {
  [coin: string]: { usd: number; usd_24h_change: number };
};

type Analysis = {
  coin: string;
  currentPrice: number;
  rsi: number | null;
  rsiSignal: string | null;
  sma7: number | null;
  sma30: number | null;
  trend: string | null;
};

const COINS = ["bitcoin", "ethereum", "solana"];
const COIN_LABELS: Record<string, string> = {
  bitcoin: "Bitcoin (BTC)",
  ethereum: "Ethereum (ETH)",
  solana: "Solana (SOL)",
};

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return null;
  const styles: Record<string, string> = {
    sobrecompra: "bg-red-500/15 text-red-400 border-red-500/30",
    sobreventa: "bg-green-500/15 text-green-400 border-green-500/30",
    neutral: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };
  const labels: Record<string, string> = {
    sobrecompra: "Sobrecompra — posible caída",
    sobreventa: "Sobreventa — posible rebote",
    neutral: "Zona neutral",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${styles[signal]}`}>
      {labels[signal]}
    </span>
  );
}

function TrendBadge({ trend }: { trend: string | null }) {
  if (!trend) return null;
  const isUp = trend === "alcista";
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full border ${
        isUp
          ? "bg-green-500/15 text-green-400 border-green-500/30"
          : "bg-red-500/15 text-red-400 border-red-500/30"
      }`}
    >
      Tendencia {trend}
    </span>
  );
}

export default function Dashboard() {
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/prices")
      .then((res) => res.json())
      .then((data) => setPrices(data))
      .catch(() => setError(true));

    COINS.forEach((coin) => {
      fetch(`/api/analysis?coin=${coin}`)
        .then((res) => res.json())
        .then((data) => setAnalyses((prev) => ({ ...prev, [coin]: data })))
        .catch(() => {});
    });
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Encabezado tipo producto */}
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📊 InvestPanel</h1>
            <p className="text-slate-400 text-sm">
              Análisis técnico de cripto en tiempo real, en español
            </p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-500 transition text-sm font-medium px-4 py-2 rounded-lg">
            Próximamente: Plan Pro
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {error && (
          <p className="text-red-400 mb-6">No se pudieron cargar los precios.</p>
        )}
        {!prices && !error && (
          <p className="text-slate-400 mb-6">Cargando precios...</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {prices &&
            COINS.map((coin) => {
              const priceData = prices[coin];
              const analysis = analyses[coin];
              if (!priceData) return null;
              const isUp = priceData.usd_24h_change >= 0;

              return (
                <div
                  key={coin}
                  className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col gap-4"
                >
                  <div>
                    <p className="text-slate-400 text-sm">{COIN_LABELS[coin]}</p>
                    <p className="text-3xl font-bold mt-1">
                      ${priceData.usd.toLocaleString()}
                    </p>
                    <p className={isUp ? "text-green-400 text-sm mt-1" : "text-red-400 text-sm mt-1"}>
                      {isUp ? "▲" : "▼"} {priceData.usd_24h_change.toFixed(2)}% (24h)
                    </p>
                  </div>

                  {analysis ? (
                    <div className="border-t border-slate-800 pt-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">RSI (14 días)</span>
                        <span className="font-mono text-sm">{analysis.rsi ?? "—"}</span>
                      </div>
                      <SignalBadge signal={analysis.rsiSignal} />

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-400 text-xs">Media 7d / 30d</span>
                        <span className="font-mono text-sm">
                          ${analysis.sma7?.toLocaleString()} / ${analysis.sma30?.toLocaleString()}
                        </span>
                      </div>
                      <TrendBadge trend={analysis.trend} />
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">Calculando análisis...</p>
                  )}
                </div>
              );
            })}
        </div>

        {/* Sección de venta / próximas funciones */}
        <div className="mt-14 bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-900/40 rounded-2xl p-8">
          <p className="text-blue-400 text-sm font-medium mb-2">🔒 Plan Pro (próximamente)</p>
          <h2 className="text-2xl font-bold mb-3">
            Alertas automáticas y seguimiento de tu cartera
          </h2>
          <p className="text-slate-400 max-w-2xl mb-5">
            Recibe un aviso cuando una moneda entre en zona de sobrecompra o sobreventa,
            registra tu propia cartera y compara tu rendimiento en el tiempo — todo en
            español, pensado para gente que empieza en cripto.
          </p>
          <button className="bg-blue-600 hover:bg-blue-500 transition text-sm font-medium px-5 py-2.5 rounded-lg">
            Unirme a la lista de espera
          </button>
        </div>

        <p className="text-slate-600 text-xs mt-8 text-center">
          Los precios se actualizan automáticamente. Esto no es asesoría financiera.
        </p>
      </div>
    </main>
  );
}
