"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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
  history: { date: string; price: number }[];
};

const ALL_COINS: { id: string; label: string }[] = [
  { id: "bitcoin", label: "Bitcoin (BTC)" },
  { id: "ethereum", label: "Ethereum (ETH)" },
  { id: "solana", label: "Solana (SOL)" },
  { id: "cardano", label: "Cardano (ADA)" },
  { id: "ripple", label: "XRP" },
  { id: "dogecoin", label: "Dogecoin (DOGE)" },
  { id: "polkadot", label: "Polkadot (DOT)" },
  { id: "avalanche-2", label: "Avalanche (AVAX)" },
  { id: "chainlink", label: "Chainlink (LINK)" },
  { id: "litecoin", label: "Litecoin (LTC)" },
];

const DEFAULT_WATCHLIST = ["bitcoin", "ethereum", "solana"];
const STORAGE_KEY = "invest-watchlist";

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

function CoinCard({
  coinId,
  label,
  priceData,
  analysis,
  onRemove,
}: {
  coinId: string;
  label: string;
  priceData?: { usd: number; usd_24h_change: number };
  analysis?: Analysis;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!priceData) return null;
  const isUp = priceData.usd_24h_change >= 0;

  return (
    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className="text-3xl font-bold mt-1">${priceData.usd.toLocaleString()}</p>
          <p className={isUp ? "text-green-400 text-sm mt-1" : "text-red-400 text-sm mt-1"}>
            {isUp ? "▲" : "▼"} {priceData.usd_24h_change.toFixed(2)}% (24h)
          </p>
        </div>
        <button
          onClick={onRemove}
          className="text-slate-600 hover:text-red-400 transition text-lg leading-none"
          title="Quitar de mi lista"
        >
          ✕
        </button>
      </div>

      {analysis ? (
        <>
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

          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-blue-400 text-xs text-left hover:underline"
          >
            {expanded ? "Ocultar gráfico ▲" : "Ver gráfico de 30 días ▼"}
          </button>

          {expanded && analysis.history && (
            <div className="h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={(d: string) => d.slice(5)}
                    minTickGap={30}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    domain={["auto", "auto"]}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <p className="text-slate-500 text-xs">Calculando análisis...</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  const [error, setError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Cargar la lista guardada del usuario (si existe)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch {
        // ignorar si está corrupto
      }
    }
  }, []);

  // Guardar cada vez que cambie
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    if (watchlist.length === 0) {
      setPrices({});
      return;
    }
    fetch(`/api/prices?coins=${watchlist.join(",")}`)
      .then((res) => res.json())
      .then((data) => setPrices(data))
      .catch(() => setError(true));

    watchlist.forEach((coin) => {
      fetch(`/api/analysis?coin=${coin}`)
        .then((res) => res.json())
        .then((data) => setAnalyses((prev) => ({ ...prev, [coin]: data })))
        .catch(() => {});
    });
  }, [watchlist]);

  const addCoin = (coinId: string) => {
    if (!watchlist.includes(coinId)) {
      setWatchlist([...watchlist, coinId]);
    }
    setShowAdd(false);
  };

  const removeCoin = (coinId: string) => {
    setWatchlist(watchlist.filter((c) => c !== coinId));
  };

  const availableToAdd = ALL_COINS.filter((c) => !watchlist.includes(c.id));

  return (
    <main className="min-h-screen bg-slate-950 text-white">
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

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Mi lista</h2>
          <div className="relative">
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="bg-slate-800 hover:bg-slate-700 transition text-sm px-3 py-1.5 rounded-lg"
            >
              + Agregar moneda
            </button>
            {showAdd && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
                {availableToAdd.length === 0 && (
                  <p className="text-slate-500 text-xs p-3">Ya agregaste todas</p>
                )}
                {availableToAdd.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => addCoin(c.id)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {prices &&
            watchlist.map((coinId) => {
              const coinInfo = ALL_COINS.find((c) => c.id === coinId);
              return (
                <CoinCard
                  key={coinId}
                  coinId={coinId}
                  label={coinInfo?.label || coinId}
                  priceData={prices[coinId]}
                  analysis={analyses[coinId]}
                  onRemove={() => removeCoin(coinId)}
                />
              );
            })}
        </div>

        {watchlist.length === 0 && prices && (
          <p className="text-slate-500 text-center py-10">
            Tu lista está vacía. Agrega una moneda para empezar.
          </p>
        )}

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
