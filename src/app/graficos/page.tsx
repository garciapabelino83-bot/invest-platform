"use client";

import { useState } from "react";
import Link from "next/link";
import TradingViewChart from "@/components/TradingViewChart";

const MARKETS = {
  cripto: [
    { symbol: "BINANCE:BTCUSDT", label: "Bitcoin (BTC)" },
    { symbol: "BINANCE:ETHUSDT", label: "Ethereum (ETH)" },
    { symbol: "BINANCE:SOLUSDT", label: "Solana (SOL)" },
    { symbol: "BINANCE:ADAUSDT", label: "Cardano (ADA)" },
    { symbol: "BINANCE:XRPUSDT", label: "XRP" },
    { symbol: "BINANCE:DOGEUSDT", label: "Dogecoin (DOGE)" },
  ],
  acciones: [
    { symbol: "NASDAQ:AAPL", label: "Apple (AAPL)" },
    { symbol: "NASDAQ:TSLA", label: "Tesla (TSLA)" },
    { symbol: "NASDAQ:AMZN", label: "Amazon (AMZN)" },
    { symbol: "NASDAQ:MSFT", label: "Microsoft (MSFT)" },
    { symbol: "NASDAQ:NVDA", label: "Nvidia (NVDA)" },
    { symbol: "NASDAQ:GOOGL", label: "Google (GOOGL)" },
  ],
  indices: [
    { symbol: "SP:SPX", label: "S&P 500" },
    { symbol: "NASDAQ:IXIC", label: "Nasdaq Composite" },
    { symbol: "DJ:DJI", label: "Dow Jones" },
    { symbol: "FOREXCOM:DXY", label: "Índice del Dólar" },
  ],
};

type MarketKey = keyof typeof MARKETS;

export default function Graficos() {
  const [market, setMarket] = useState<MarketKey>("cripto");
  const [symbol, setSymbol] = useState(MARKETS.cripto[0].symbol);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📊 InvestPanel</h1>
            <p className="text-slate-400 text-sm">Gráficos en tiempo real</p>
          </div>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-white transition"
          >
            ← Volver al panel
          </Link>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex gap-2 mb-4">
          {(Object.keys(MARKETS) as MarketKey[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMarket(m);
                setSymbol(MARKETS[m][0].symbol);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                market === m
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {MARKETS[market].map((item) => (
            <button
              key={item.symbol}
              onClick={() => setSymbol(item.symbol)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                symbol === item.symbol
                  ? "bg-slate-700 text-white border border-slate-600"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <TradingViewChart symbol={symbol} />
        </div>

        <p className="text-slate-600 text-xs mt-4 text-center">
          Gráficos proporcionados por TradingView. Esto no es asesoría financiera.
        </p>
      </div>
    </main>
  );
}
