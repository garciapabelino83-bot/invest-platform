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
  error?: boolean;
};

// Trae los análisis de a poco (en tandas de a 4) en vez de todos a la vez.
// Con la lista de monedas ampliada a 48, si alguien agrega muchas a "Mi
// lista" y todas piden su análisis técnico al mismo tiempo, podemos topar
// con el límite de peticiones gratuito de la API de CoinGecko y varias
// tarjetas se quedan cargando para siempre. Pedirlas de a poco evita eso.
async function fetchAnalysesEnTandas(
  coins: string[],
  onResultado: (coin: string, data: Analysis) => void,
  tandaSize = 4
) {
  for (let i = 0; i < coins.length; i += tandaSize) {
    const tanda = coins.slice(i, i + tandaSize);
    await Promise.all(
      tanda.map((coin) =>
        fetch(`/api/analysis?coin=${coin}`)
          .then((res) => {
            if (!res.ok) throw new Error("fallo");
            return res.json();
          })
          .then((data) => onResultado(coin, data))
          .catch(() => onResultado(coin, { error: true } as Analysis))
      )
    );
  }
}

// Lista de monedas disponibles para "Mi lista" (dashboard con precio +
// análisis técnico vía CoinGecko). Incluye las principales, varios
// altcoins de capitalización media y las memecoins más conocidas — el
// mismo criterio que ya usamos en /graficos, pero aquí necesitamos el id
// exacto de CoinGecko (no el símbolo de Binance) porque /api/prices y
// /api/analysis consultan la API de CoinGecko.
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
  { id: "binancecoin", label: "BNB" },
  { id: "tron", label: "TRON (TRX)" },
  { id: "the-open-network", label: "Toncoin (TON)" },
  { id: "matic-network", label: "Polygon (POL)" },
  { id: "cosmos", label: "Cosmos (ATOM)" },
  { id: "near", label: "NEAR Protocol (NEAR)" },
  { id: "arbitrum", label: "Arbitrum (ARB)" },
  { id: "optimism", label: "Optimism (OP)" },
  { id: "sui", label: "Sui (SUI)" },
  { id: "aptos", label: "Aptos (APT)" },
  { id: "injective-protocol", label: "Injective (INJ)" },
  { id: "uniswap", label: "Uniswap (UNI)" },
  { id: "aave", label: "Aave (AAVE)" },
  { id: "the-sandbox", label: "The Sandbox (SAND)" },
  { id: "decentraland", label: "Decentraland (MANA)" },
  { id: "fantom", label: "Fantom (FTM)" },
  { id: "algorand", label: "Algorand (ALGO)" },
  { id: "vechain", label: "VeChain (VET)" },
  { id: "internet-computer", label: "Internet Computer (ICP)" },
  { id: "filecoin", label: "Filecoin (FIL)" },
  { id: "hedera-hashgraph", label: "Hedera (HBAR)" },
  { id: "stellar", label: "Stellar (XLM)" },
  { id: "ethereum-classic", label: "Ethereum Classic (ETC)" },
  { id: "bitcoin-cash", label: "Bitcoin Cash (BCH)" },
  { id: "eos", label: "EOS" },
  { id: "the-graph", label: "The Graph (GRT)" },
  { id: "lido-dao", label: "Lido DAO (LDO)" },
  { id: "thorchain", label: "THORChain (RUNE)" },
  { id: "celestia", label: "Celestia (TIA)" },
  { id: "sei-network", label: "Sei (SEI)" },
  { id: "worldcoin-wld", label: "Worldcoin (WLD)" },
  // --- Memecoins ---
  { id: "shiba-inu", label: "Shiba Inu (SHIB)" },
  { id: "pepe", label: "Pepe (PEPE)" },
  { id: "floki", label: "Floki (FLOKI)" },
  { id: "bonk", label: "Bonk (BONK)" },
  { id: "dogwifcoin", label: "dogwifhat (WIF)" },
  { id: "pudgy-penguins", label: "Pudgy Penguins (PENGU)" },
  { id: "ordi", label: "ORDI" },
];

const DEFAULT_WATCHLIST = ["bitcoin", "ethereum", "solana"];
const STORAGE_KEY = "invest-watchlist";
const PRO_EMAIL_KEY = "invest-pro-email";

// Formatea un precio en dólares mostrando siempre cifras significativas.
// Con solo 2 decimales fijos, cualquier memecoin que valga fracciones de
// centavo (ej. PEPE a $0.0000123) se veía como "$0". Para precios >= $1
// usamos 2 decimales de toda la vida; para precios menores, agregamos
// tantos decimales como haga falta para mostrar 4 cifras significativas.
function formatPrice(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n === 0) return "0";
  if (Math.abs(n) >= 1) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const leadingZeros = Math.max(0, -Math.floor(Math.log10(Math.abs(n))) - 1);
  const decimals = Math.min(12, leadingZeros + 4);
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

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
  onRetryAnalysis,
}: {
  coinId: string;
  label: string;
  priceData?: { usd: number; usd_24h_change: number };
  analysis?: Analysis;
  onRemove: () => void;
  onRetryAnalysis: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!priceData) return null;
  const isUp = priceData.usd_24h_change >= 0;

  return (
    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className="text-3xl font-bold mt-1">${formatPrice(priceData.usd)}</p>
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

      {analysis?.error ? (
        <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
          <p className="text-slate-500 text-xs">No se pudo cargar el análisis.</p>
          <button
            onClick={onRetryAnalysis}
            className="text-blue-400 text-xs hover:underline shrink-0 ml-2"
          >
            Reintentar
          </button>
        </div>
      ) : analysis ? (
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
                ${formatPrice(analysis.sma7)} / ${formatPrice(analysis.sma30)}
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
                    tickFormatter={(v: number) => `$${formatPrice(v)}`}
                    domain={["auto", "auto"]}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(value) => [`$${formatPrice(Number(value))}`, "Precio"]}
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
  const [addFilter, setAddFilter] = useState("");

  // --- Plan Pro ---
  const [proEmail, setProEmail] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [showSubscribeForm, setShowSubscribeForm] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

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

  // Al cargar la página: revisar si venimos de un pago en Stripe,
  // o si ya teníamos guardado el correo de un suscriptor Pro.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const emailFromRedirect = params.get("email");

    let email = localStorage.getItem(PRO_EMAIL_KEY);

    if (checkout === "exito" && emailFromRedirect) {
      email = emailFromRedirect;
      localStorage.setItem(PRO_EMAIL_KEY, email);
      setCheckoutMessage(
        "¡Listo! Tu prueba gratis de 7 días del Plan Pro ya inició. Puede tardar unos segundos en activarse."
      );
    } else if (checkout === "cancelado") {
      setCheckoutMessage("Cancelaste el pago. Puedes intentarlo de nuevo cuando quieras.");
    }

    // Limpiar la URL para que no quede el parámetro al recargar
    if (checkout) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (email) {
      setProEmail(email);
    }
  }, []);

  // Revisar en el servidor si el correo guardado ya tiene el Plan Pro activo
  useEffect(() => {
    if (!proEmail) return;
    fetch(`/api/subscription-status?email=${encodeURIComponent(proEmail)}`)
      .then((res) => res.json())
      .then((data) => setIsPro(!!data.isPro))
      .catch(() => {});
  }, [proEmail]);

  const startSubscription = async () => {
    if (!subscribeEmail || !subscribeEmail.includes("@")) {
      setSubscribeError("Escribe un correo válido");
      return;
    }
    setSubscribing(true);
    setSubscribeError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: subscribeEmail }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setSubscribeError("No se pudo iniciar el pago. Intenta de nuevo.");
      }
    } catch {
      setSubscribeError("No se pudo iniciar el pago. Intenta de nuevo.");
    } finally {
      setSubscribing(false);
    }
  };

  useEffect(() => {
    if (watchlist.length === 0) {
      setPrices({});
      return;
    }
    setError(false);
    fetch(`/api/prices?coins=${watchlist.join(",")}`)
      .then((res) => {
        if (!res.ok) throw new Error("fallo");
        return res.json();
      })
      .then((data) => setPrices(data))
      .catch(() => setError(true));

    fetchAnalysesEnTandas(watchlist, (coin, data) => {
      setAnalyses((prev) => ({ ...prev, [coin]: data }));
    });
  }, [watchlist]);

  const addCoin = (coinId: string) => {
    if (!watchlist.includes(coinId)) {
      setWatchlist([...watchlist, coinId]);
    }
    setShowAdd(false);
    setAddFilter("");
  };

  const removeCoin = (coinId: string) => {
    setWatchlist(watchlist.filter((c) => c !== coinId));
  };

  const availableToAdd = ALL_COINS.filter(
    (c) =>
      !watchlist.includes(c.id) &&
      c.label.toLowerCase().includes(addFilter.toLowerCase())
  );

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
          <div className="flex items-center gap-3">
            <a
              href="/ayuda"
              className="text-slate-400 hover:text-white transition text-sm font-medium px-2 py-2"
            >
              📚 Guía rápida
            </a>
            <a
              href="/graficos"
              className="bg-slate-800 hover:bg-slate-700 transition text-sm font-medium px-4 py-2 rounded-lg"
            >
              📈 Ver gráficos (cripto, acciones, índices)
            </a>
            {isPro ? (
              <span className="bg-blue-600/20 text-blue-400 border border-blue-600/40 text-sm font-medium px-4 py-2 rounded-lg">
                ✓ Plan Pro activo
              </span>
            ) : (
              <button
                onClick={() => setShowSubscribeForm(true)}
                className="bg-blue-600 hover:bg-blue-500 transition text-sm font-medium px-4 py-2 rounded-lg"
              >
                Plan Pro — $9.99/mes
              </button>
            )}
          </div>
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
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-lg z-10 max-h-72 overflow-y-auto">
                <div className="sticky top-0 bg-slate-900 p-2 border-b border-slate-800">
                  <input
                    autoFocus
                    value={addFilter}
                    onChange={(e) => setAddFilter(e.target.value)}
                    placeholder="Buscar moneda..."
                    className="w-full bg-slate-800 text-sm rounded-lg px-3 py-1.5 outline-none placeholder:text-slate-500"
                  />
                </div>
                {availableToAdd.length === 0 && (
                  <p className="text-slate-500 text-xs p-3">
                    {ALL_COINS.every((c) => watchlist.includes(c.id))
                      ? "Ya agregaste todas"
                      : "Sin resultados"}
                  </p>
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
                  onRetryAnalysis={() =>
                    fetchAnalysesEnTandas([coinId], (coin, data) => {
                      setAnalyses((prev) => ({ ...prev, [coin]: data }));
                    })
                  }
                />
              );
            })}
        </div>

        {watchlist.length === 0 && prices && (
          <p className="text-slate-500 text-center py-10">
            Tu lista está vacía. Agrega una moneda para empezar.
          </p>
        )}

        {checkoutMessage && (
          <div className="mb-6 bg-blue-950/40 border border-blue-900/40 text-blue-300 text-sm rounded-xl px-4 py-3">
            {checkoutMessage}
          </div>
        )}

        <div className="mt-14 bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-900/40 rounded-2xl p-8">
          {isPro ? (
            <>
              <p className="text-blue-400 text-sm font-medium mb-2">🔓 Plan Pro</p>
              <h2 className="text-2xl font-bold mb-3">¡Ya tienes acceso al Plan Pro!</h2>
              <p className="text-slate-400 max-w-2xl">
                Gracias por suscribirte. Estamos construyendo las alertas automáticas y el
                seguimiento de cartera — pronto se activan solas en tu cuenta, sin que tengas
                que hacer nada.
              </p>
            </>
          ) : (
            <>
              <p className="text-blue-400 text-sm font-medium mb-2">🔒 Plan Pro — $9.99/mes</p>
              <h2 className="text-2xl font-bold mb-3">
                Alertas automáticas y seguimiento de tu cartera
              </h2>
              <p className="text-slate-400 max-w-2xl mb-5">
                Recibe un aviso cuando una moneda entre en zona de sobrecompra o sobreventa,
                registra tu propia cartera y compara tu rendimiento en el tiempo — todo en
                español, pensado para gente que empieza en cripto. Incluye 7 días de prueba
                gratis.
              </p>

              {showSubscribeForm ? (
                <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm flex-1 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={startSubscription}
                    disabled={subscribing}
                    className="bg-blue-600 hover:bg-blue-500 transition text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-50"
                  >
                    {subscribing ? "Un momento..." : "Empezar prueba gratis"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSubscribeForm(true)}
                  className="bg-blue-600 hover:bg-blue-500 transition text-sm font-medium px-5 py-2.5 rounded-lg"
                >
                  Empezar prueba gratis de 7 días
                </button>
              )}
              {subscribeError && (
                <p className="text-red-400 text-xs mt-3">{subscribeError}</p>
              )}
            </>
          )}
        </div>

        <p className="text-slate-600 text-xs mt-8 text-center">
          Los precios se actualizan automáticamente. Esto no es asesoría financiera.
        </p>
      </div>
    </main>
  );
}
