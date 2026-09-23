"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import VolumeImbalanceSection from "./VolumeImbalanceSection";

const VERDE = "#0ecb81";
const ROJO = "#f6465d";

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
// filas se quedan cargando para siempre. Pedirlas de a poco evita eso.
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

// Separa una etiqueta tipo "Bitcoin (BTC)" en nombre + símbolo. Las que no
// tienen paréntesis (XRP, BNB, EOS...) usan la misma palabra para ambos.
function partirEtiqueta(label: string): { nombre: string; simbolo: string } {
  const match = label.match(/^(.*) \(([^)]+)\)$/);
  if (match) return { nombre: match[1], simbolo: match[2] };
  return { nombre: label, simbolo: label };
}

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

function colorRsi(signal: string | null) {
  if (signal === "sobrecompra") return "text-[#f6465d]";
  if (signal === "sobreventa") return "text-[#0ecb81]";
  return "text-neutral-300";
}

function tituloRsi(signal: string | null) {
  if (signal === "sobrecompra") return "Sobrecompra — posible caída";
  if (signal === "sobreventa") return "Sobreventa — posible rebote";
  return "Zona neutral";
}

function CoinRow({
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
  if (!priceData) return null;
  const { nombre, simbolo } = partirEtiqueta(label);
  const subiendo = priceData.usd_24h_change >= 0;
  const tendenciaAlcista = analysis?.trend === "alcista";

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.03] transition group">
      <td className="py-3 pl-4 pr-2">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-[10px] font-bold text-neutral-300 shrink-0">
            {simbolo.slice(0, 1)}
          </span>
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold whitespace-nowrap">{simbolo}</p>
            <p className="text-[11px] text-neutral-500 truncate">{nombre}</p>
          </div>
        </div>
      </td>

      <td className="py-3 px-3 text-right font-mono text-sm tabular-nums whitespace-nowrap">
        ${formatPrice(priceData.usd)}
      </td>

      <td
        className={`py-3 px-3 text-right font-mono text-sm tabular-nums whitespace-nowrap ${
          subiendo ? "text-[#0ecb81]" : "text-[#f6465d]"
        }`}
      >
        {subiendo ? "+" : ""}
        {priceData.usd_24h_change.toFixed(2)}%
      </td>

      <td className="py-3 px-3 text-right hidden sm:table-cell">
        {analysis?.error ? (
          <button onClick={onRetryAnalysis} className="text-neutral-500 text-xs hover:text-white hover:underline">
            Reintentar
          </button>
        ) : analysis ? (
          <span
            className={`font-mono text-sm tabular-nums ${colorRsi(analysis.rsiSignal)}`}
            title={tituloRsi(analysis.rsiSignal)}
          >
            {analysis.rsi ?? "—"}
          </span>
        ) : (
          <span className="text-neutral-700 text-xs">…</span>
        )}
      </td>

      <td className="py-3 px-3 hidden md:table-cell">
        {analysis && !analysis.error && analysis.trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
              tendenciaAlcista ? "text-[#0ecb81]" : "text-[#f6465d]"
            }`}
          >
            {tendenciaAlcista ? "▲" : "▼"} {analysis.trend}
          </span>
        )}
      </td>

      <td className="py-3 px-3 hidden lg:table-cell">
        <div className="w-[110px] h-9">
          {analysis && !analysis.error && analysis.history && analysis.history.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analysis.history}>
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={tendenciaAlcista ? VERDE : ROJO}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center text-neutral-700 text-xs">—</div>
          )}
        </div>
      </td>

      <td className="py-3 pr-4 pl-2 text-right">
        <button
          onClick={onRemove}
          className="text-neutral-700 hover:text-[#f6465d] transition text-sm leading-none opacity-0 group-hover:opacity-100"
          title="Quitar de mi lista"
        >
          ✕
        </button>
      </td>
    </tr>
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
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-6 py-3.5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">InvestPanel</h1>
            <p className="text-neutral-500 text-[11px]">
              Análisis técnico de cripto en tiempo real, en español
            </p>
          </div>
          <div className="flex items-center gap-5">
            <a href="/ayuda" className="text-xs text-neutral-400 hover:text-white transition">
              Guía rápida
            </a>
            <a href="/graficos" className="text-xs text-neutral-400 hover:text-white transition">
              Ver gráficos (cripto, acciones, índices)
            </a>
            <a href="/herramientas" className="text-xs text-neutral-400 hover:text-white transition">
              🧮 Herramientas
            </a>
            {isPro ? (
              <span className="bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/30 text-xs font-medium px-3 py-1.5 rounded-lg">
                Plan Pro activo
              </span>
            ) : (
              <button
                onClick={() => setShowSubscribeForm(true)}
                className="bg-white text-black hover:bg-neutral-200 transition text-xs font-semibold px-3.5 py-1.5 rounded-lg"
              >
                Plan Pro — $9.99/mes
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- Hero: lo primero que ve alguien que nunca ha usado InvestPanel --- */}
      <section className="border-b border-white/10 bg-gradient-to-b from-[#0a0a0b] to-black">
        <div className="max-w-[1400px] mx-auto px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[#0ecb81] text-xs font-semibold uppercase tracking-wide mb-4">
              Gratis para empezar · Sin tarjeta
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-5">
              Todo lo que necesitas para seguir cripto y acciones, en español
            </h2>
            <p className="text-neutral-400 text-base sm:text-lg max-w-xl mb-8">
              Gráficos en tiempo real, indicadores técnicos como RSI y MACD, alertas de precio y
              herramientas para calcular tus ganancias — sin pagar los $30+ al mes que cobran las
              plataformas en inglés.
            </p>

            <ul className="grid sm:grid-cols-2 gap-3 mb-9 max-w-xl">
              {[
                ["📊", "Gráficos de velas en tiempo real (cripto, acciones e índices)"],
                ["🔔", "Avisos cuando el precio llegue a tu nivel"],
                ["🧮", "Calculadora de ganancias, comparador y convertidor"],
                ["🇪🇸", "Todo en español, explicado sin tecnicismos"],
              ].map(([emoji, texto]) => (
                <li key={texto} className="flex items-start gap-2.5 text-sm text-neutral-300">
                  <span className="text-base leading-none">{emoji}</span>
                  <span>{texto}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/graficos"
                className="bg-white text-black hover:bg-neutral-200 transition text-sm font-semibold px-5 py-3 rounded-lg"
              >
                Ver gráficos gratis →
              </a>
              <a
                href="#plan-pro"
                className="bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm font-medium px-5 py-3 rounded-lg"
              >
                Conocer el Plan Pro
              </a>
            </div>
          </div>

          {/* Mini gráfico decorativo (no es una captura real, solo ilustra el producto) */}
          <div className="bg-[#0a0a0b] border border-white/10 rounded-2xl p-6 hidden lg:block">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold">BTC/USDT</p>
                <p className="text-[11px] text-neutral-500">Gráfico en vivo · InvestPanel</p>
              </div>
              <p className="text-[#0ecb81] font-mono text-sm">+2.4%</p>
            </div>
            <div className="flex items-end gap-1.5 h-40">
              {[40, 55, 35, 70, 50, 80, 45, 65, 90, 55, 75, 45, 100, 65, 85, 110].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ height: `${h}px`, background: i % 3 === 1 ? ROJO : VERDE }}
                />
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">RSI (14d)</p>
                <p className="text-sm font-mono text-[#0ecb81]">58</p>
              </div>
              <div>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Tendencia</p>
                <p className="text-sm font-mono text-[#0ecb81]">▲ Alcista</p>
              </div>
              <div>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Monedas</p>
                <p className="text-sm font-mono">200+</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="mi-lista" className="max-w-[1400px] mx-auto px-6 py-8">
        {error && (
          <p className="text-[#f6465d] text-sm mb-6">No se pudieron cargar los precios.</p>
        )}
        {!prices && !error && (
          <p className="text-neutral-500 text-sm mb-6">Cargando precios...</p>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">Mi lista</h2>
          <div className="relative">
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              + Agregar moneda
            </button>
            {showAdd && (
              <div className="absolute right-0 mt-2 w-60 bg-[#111113] border border-white/10 rounded-xl shadow-2xl z-20 max-h-72 overflow-y-auto">
                <div className="sticky top-0 bg-[#111113] p-2 border-b border-white/10">
                  <input
                    autoFocus
                    value={addFilter}
                    onChange={(e) => setAddFilter(e.target.value)}
                    placeholder="Buscar moneda..."
                    className="w-full bg-black border border-white/10 text-sm rounded-lg px-3 py-1.5 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                  />
                </div>
                {availableToAdd.length === 0 && (
                  <p className="text-neutral-600 text-xs p-3">
                    {ALL_COINS.every((c) => watchlist.includes(c.id))
                      ? "Ya agregaste todas"
                      : "Sin resultados"}
                  </p>
                )}
                {availableToAdd.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => addCoin(c.id)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0a0a0b] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="text-left font-medium py-2.5 pl-4 pr-2">Moneda</th>
                  <th className="text-right font-medium py-2.5 px-3">Precio</th>
                  <th className="text-right font-medium py-2.5 px-3">Cambio 24h</th>
                  <th className="text-right font-medium py-2.5 px-3 hidden sm:table-cell">RSI (14d)</th>
                  <th className="text-left font-medium py-2.5 px-3 hidden md:table-cell">Tendencia</th>
                  <th className="text-left font-medium py-2.5 px-3 hidden lg:table-cell">Gráfico 30d</th>
                  <th className="py-2.5 pr-4 pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {prices &&
                  watchlist.map((coinId) => {
                    const coinInfo = ALL_COINS.find((c) => c.id === coinId);
                    return (
                      <CoinRow
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
              </tbody>
            </table>
          </div>

          {watchlist.length === 0 && prices && (
            <p className="text-neutral-600 text-sm text-center py-10">
              Tu lista está vacía. Agrega una moneda para empezar.
            </p>
          )}
        </div>

        {checkoutMessage && (
          <div className="mt-6 bg-[#0ecb81]/5 border border-[#0ecb81]/20 text-[#0ecb81] text-sm rounded-xl px-4 py-3">
            {checkoutMessage}
          </div>
        )}

        <div id="plan-pro" className="mt-10 bg-[#0a0a0b] border border-white/10 rounded-xl p-7">
          {isPro ? (
            <>
              <p className="text-[#0ecb81] text-[11px] font-semibold uppercase tracking-wide mb-2">Plan Pro</p>
              <h2 className="text-xl font-bold mb-3">Ya tienes acceso al Plan Pro</h2>
              <p className="text-neutral-400 text-sm max-w-2xl">
                Gracias por suscribirte. Estamos construyendo las alertas automáticas y el
                seguimiento de cartera — pronto se activan solas en tu cuenta, sin que tengas
                que hacer nada.
              </p>
            </>
          ) : (
            <>
              <p className="text-neutral-500 text-[11px] font-semibold uppercase tracking-wide mb-2">
                Plan Pro — $9.99/mes
              </p>
              <h2 className="text-xl font-bold mb-3">
                Alertas automáticas y seguimiento de tu cartera
              </h2>
              <p className="text-neutral-400 text-sm max-w-2xl mb-5">
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
                    className="bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm flex-1 focus:outline-none focus:border-neutral-500"
                  />
                  <button
                    onClick={startSubscription}
                    disabled={subscribing}
                    className="bg-[#0ecb81] hover:opacity-90 text-black transition text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-50"
                  >
                    {subscribing ? "Un momento..." : "Empezar prueba gratis"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSubscribeForm(true)}
                  className="bg-[#0ecb81] hover:opacity-90 text-black transition text-sm font-semibold px-5 py-2.5 rounded-lg"
                >
                  Empezar prueba gratis de 7 días
                </button>
              )}
              {subscribeError && (
                <p className="text-[#f6465d] text-xs mt-3">{subscribeError}</p>
              )}
            </>
          )}
        </div>

        {/* --- Volume Imbalance (VI): funcion destacada del Plan Pro.
            Bloqueada (con blur + candado) para quien no es Pro, activa y
            funcional para quien ya se suscribio. */}
        <div className="mt-6">
          <VolumeImbalanceSection locked={!isPro} />
        </div>

        {/* --- Preguntas frecuentes: resuelve las dudas típicas antes de que
            alguien nuevo se vaya sin probar la plataforma --- */}
        <div className="mt-16">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide mb-5">
            Preguntas frecuentes
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              [
                "¿InvestPanel es gratis?",
                "Sí. Ver precios, gráficos, indicadores técnicos (RSI, MACD, medias móviles) y usar la calculadora, el comparador y el convertidor no cuesta nada. El Plan Pro ($9.99/mes, con 7 días de prueba gratis) agrega avisos automáticos de precio y seguimiento de tu cartera.",
              ],
              [
                "¿Necesito experiencia con cripto o bolsa?",
                "No. Está pensado para gente que recién empieza: cada indicador tiene una explicación en español sin tecnicismos, y puedes empezar solo mirando el precio antes de usar las herramientas más avanzadas.",
              ],
              [
                "¿Qué monedas y mercados cubre?",
                "Más de 200 criptomonedas (desde Bitcoin y Ethereum hasta memecoins) y también acciones e índices bursátiles, todo desde la misma pantalla de gráficos.",
              ],
              [
                "¿Puedo cancelar el Plan Pro cuando quiera?",
                "Sí, no hay contrato ni permanencia. Cancelas cuando quieras y sigues usando gratis todo lo que no es Pro.",
              ],
            ].map(([pregunta, respuesta]) => (
              <div key={pregunta} className="bg-[#0a0a0b] border border-white/10 rounded-xl p-5">
                <p className="text-sm font-semibold mb-2">{pregunta}</p>
                <p className="text-neutral-400 text-sm leading-relaxed">{respuesta}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-neutral-700 text-[11px] mt-8 text-center">
          Los precios se actualizan automáticamente. Esto no es asesoría financiera.
        </p>
      </div>
    </main>
  );
}
