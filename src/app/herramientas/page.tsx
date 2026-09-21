"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { MONEDAS, FIAT } from "@/lib/monedas";

const COLORES_COMPARADOR = ["#38bdf8", "#f0b90b", "#a855f7", "#0ecb81"];

type Tab = "calculadora" | "convertidor" | "comparador";

// Mismo criterio de decimales adaptables que usa "Mi lista": 2 decimales
// para precios de $1 o más, y varios decimales para monedas que valen
// fracciones de centavo (memecoins), para no mostrar "$0".
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

function TabBtn({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
        activo ? "bg-white text-black" : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputClase =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition";
const selectClase = inputClase + " appearance-none";

// ---------------------------------------------------------------------
// 1) Calculadora de ganancias / pérdidas
// ---------------------------------------------------------------------
function CalculadoraPnL() {
  const [tipo, setTipo] = useState<"long" | "short">("long");
  const [entrada, setEntrada] = useState("");
  const [salida, setSalida] = useState("");
  const [invertido, setInvertido] = useState("");
  const [comision, setComision] = useState("0.1");

  const resultado = useMemo(() => {
    const e = parseFloat(entrada);
    const s = parseFloat(salida);
    const inv = parseFloat(invertido);
    const com = parseFloat(comision) || 0;
    if (!e || !s || !inv || e <= 0 || inv <= 0) return null;

    const cantidad = inv / e;
    const pnlBruto = tipo === "long" ? cantidad * (s - e) : cantidad * (e - s);
    // Comisión aproximada: se cobra al entrar y al salir de la operación.
    const comisionMonto = inv * (com / 100) * 2;
    const pnlNeto = pnlBruto - comisionMonto;
    const pnlPct = (pnlNeto / inv) * 100;
    const valorFinal = inv + pnlNeto;

    return { cantidad, pnlBruto, comisionMonto, pnlNeto, pnlPct, valorFinal };
  }, [tipo, entrada, salida, invertido, comision]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Campo label="Tipo de operación">
          <div className="flex gap-2">
            <button
              onClick={() => setTipo("long")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                tipo === "long" ? "bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40" : "bg-white/5 text-neutral-400 border border-white/10"
              }`}
            >
              📈 Compra (Long)
            </button>
            <button
              onClick={() => setTipo("short")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                tipo === "short" ? "bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/40" : "bg-white/5 text-neutral-400 border border-white/10"
              }`}
            >
              📉 Venta en corto (Short)
            </button>
          </div>
        </Campo>

        <Campo label="Precio de entrada (USD)">
          <input
            type="number"
            inputMode="decimal"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder="Ej: 65000"
            className={inputClase}
          />
        </Campo>

        <Campo label="Precio de salida (USD)">
          <input
            type="number"
            inputMode="decimal"
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
            placeholder="Ej: 70000"
            className={inputClase}
          />
        </Campo>

        <Campo label="Cantidad invertida (USD)">
          <input
            type="number"
            inputMode="decimal"
            value={invertido}
            onChange={(e) => setInvertido(e.target.value)}
            placeholder="Ej: 500"
            className={inputClase}
          />
        </Campo>

        <Campo label="Comisión del exchange, por operación (%) — opcional">
          <input
            type="number"
            inputMode="decimal"
            value={comision}
            onChange={(e) => setComision(e.target.value)}
            placeholder="Ej: 0.1"
            className={inputClase}
          />
        </Campo>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-fit">
        <h3 className="text-sm font-semibold text-neutral-300 mb-4">Resultado</h3>
        {!resultado ? (
          <p className="text-sm text-neutral-500">
            Completa el precio de entrada, salida y cuánto invertiste para ver el resultado.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-neutral-500">Ganancia / pérdida neta</span>
              <span
                className={`text-2xl font-bold ${resultado.pnlNeto >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}
              >
                {resultado.pnlNeto >= 0 ? "+" : ""}${formatPrice(resultado.pnlNeto)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Porcentaje</span>
              <span className={resultado.pnlPct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                {resultado.pnlPct >= 0 ? "+" : ""}
                {resultado.pnlPct.toFixed(2)}%
              </span>
            </div>
            <div className="border-t border-white/10 my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Cantidad comprada</span>
              <span className="text-neutral-300 font-mono">{formatPrice(resultado.cantidad)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Comisión estimada (entrada + salida)</span>
              <span className="text-neutral-300 font-mono">${formatPrice(resultado.comisionMonto)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Valor final de tu inversión</span>
              <span className="text-neutral-300 font-mono">${formatPrice(resultado.valorFinal)}</span>
            </div>
          </div>
        )}
        <p className="text-[10px] text-neutral-600 mt-4">
          Esta calculadora es solo una guía educativa, no es asesoría financiera. Los resultados reales
          pueden variar por comisiones, impuestos o el deslizamiento del precio (slippage).
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 2) Convertidor de monedas (cripto y fiat)
// ---------------------------------------------------------------------
type Opcion = { id: string; label: string; tipo: "cripto" | "fiat" };

const OPCIONES: Opcion[] = [
  ...FIAT.map((f) => ({ id: f.code, label: f.label, tipo: "fiat" as const })),
  ...MONEDAS.map((m) => ({ id: m.id, label: m.label, tipo: "cripto" as const })),
];

function Convertidor() {
  const [de, setDe] = useState("bitcoin");
  const [a, setA] = useState("USD");
  const [monto, setMonto] = useState("1");
  const [precios, setPrecios] = useState<Record<string, number>>({});
  const [tasas, setTasas] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  const opcionDe = OPCIONES.find((o) => o.id === de);
  const opcionA = OPCIONES.find((o) => o.id === a);

  useEffect(() => {
    const idsCripto = [de, a].filter((id) => MONEDAS.some((m) => m.id === id));
    setCargando(true);
    setError(false);

    Promise.all([
      idsCripto.length > 0
        ? fetch(`/api/prices?coins=${idsCripto.join(",")}`).then((res) => {
            if (!res.ok) throw new Error("fallo");
            return res.json();
          })
        : Promise.resolve({}),
      fetch("/api/fx").then((res) => {
        if (!res.ok) throw new Error("fallo");
        return res.json();
      }),
    ])
      .then(([preciosData, fxData]) => {
        const nuevosPrecios: Record<string, number> = {};
        Object.keys(preciosData).forEach((id) => {
          nuevosPrecios[id] = preciosData[id]?.usd;
        });
        setPrecios(nuevosPrecios);
        setTasas(fxData.rates || {});
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [de, a]);

  const resultado = useMemo(() => {
    const m = parseFloat(monto);
    if (!m || !opcionDe || !opcionA) return null;

    // Paso 1: convertir el monto de origen a USD.
    let enUsd: number | null = null;
    if (opcionDe.tipo === "cripto") {
      const precio = precios[opcionDe.id];
      if (!precio) return null;
      enUsd = m * precio;
    } else {
      const tasa = opcionDe.id === "USD" ? 1 : tasas[opcionDe.id];
      if (!tasa) return null;
      enUsd = m / tasa;
    }

    // Paso 2: convertir de USD a la moneda destino.
    let final: number | null = null;
    if (opcionA.tipo === "cripto") {
      const precio = precios[opcionA.id];
      if (!precio) return null;
      final = enUsd / precio;
    } else {
      const tasa = opcionA.id === "USD" ? 1 : tasas[opcionA.id];
      if (!tasa) return null;
      final = enUsd * tasa;
    }

    return final;
  }, [monto, opcionDe, opcionA, precios, tasas]);

  const intercambiar = () => {
    setDe(a);
    setA(de);
  };

  return (
    <div className="max-w-xl">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <Campo label="De">
          <select value={de} onChange={(e) => setDe(e.target.value)} className={selectClase}>
            <optgroup label="Monedas fiat">
              {FIAT.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Criptomonedas">
              {MONEDAS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          </select>
        </Campo>

        <button
          onClick={intercambiar}
          title="Invertir"
          className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center text-neutral-400 mb-0.5"
        >
          ⇄
        </button>

        <Campo label="A">
          <select value={a} onChange={(e) => setA(e.target.value)} className={selectClase}>
            <optgroup label="Monedas fiat">
              {FIAT.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Criptomonedas">
              {MONEDAS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          </select>
        </Campo>
      </div>

      <div className="mt-4">
        <Campo label="Cantidad">
          <input
            type="number"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={inputClase}
          />
        </Campo>
      </div>

      <div className="mt-5 bg-white/5 border border-white/10 rounded-xl p-5">
        {cargando ? (
          <p className="text-sm text-neutral-500">Calculando...</p>
        ) : error ? (
          <p className="text-sm text-[#f6465d]">
            No se pudo obtener el precio en este momento. Intenta de nuevo en un momento.
          </p>
        ) : resultado === null ? (
          <p className="text-sm text-neutral-500">Escribe una cantidad para ver la conversión.</p>
        ) : (
          <p className="text-xl font-bold text-white">
            {monto} {opcionDe?.tipo === "fiat" ? opcionDe.id : opcionDe?.label.split(" (")[0]} ≈{" "}
            <span className="text-[#0ecb81]">
              {formatPrice(resultado)} {opcionA?.tipo === "fiat" ? opcionA.id : opcionA?.label.split(" (")[0]}
            </span>
          </p>
        )}
      </div>
      <p className="text-[10px] text-neutral-600 mt-3">
        Precios de criptomonedas vía CoinGecko y tipos de cambio de monedas fiat actualizados cada hora.
        Son valores de referencia; el precio real puede variar un poco según dónde compres o vendas.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// 3) Comparador de monedas
// ---------------------------------------------------------------------
type CompareCoin = {
  coin: string;
  currentPrice: number;
  changePct: number;
  history: { date: string; price: number; pct: number }[];
};

const PERIODOS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
];

function nombreCorto(id: string) {
  const m = MONEDAS.find((x) => x.id === id);
  if (!m) return id;
  const match = m.label.match(/\(([^)]+)\)/);
  return match ? match[1] : m.label;
}

function Comparador() {
  const [seleccion, setSeleccion] = useState<string[]>(["bitcoin", "ethereum"]);
  const [dias, setDias] = useState("30");
  const [datos, setDatos] = useState<CompareCoin[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seleccion.length < 2) {
      setDatos(null);
      return;
    }
    setCargando(true);
    setError(null);
    fetch(`/api/compare?coins=${seleccion.join(",")}&days=${dias}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo comparar");
        return data;
      })
      .then((data) => setDatos(data.coins))
      .catch((err) => setError(err.message || "No se pudo comparar en este momento"))
      .finally(() => setCargando(false));
  }, [seleccion, dias]);

  const actualizarSeleccion = (index: number, valor: string) => {
    setSeleccion((prev) => {
      const nueva = [...prev];
      nueva[index] = valor;
      return nueva;
    });
  };

  const agregarMoneda = () => {
    if (seleccion.length >= 4) return;
    const disponible = MONEDAS.find((m) => !seleccion.includes(m.id));
    if (disponible) setSeleccion((prev) => [...prev, disponible.id]);
  };

  const quitarMoneda = (index: number) => {
    if (seleccion.length <= 2) return;
    setSeleccion((prev) => prev.filter((_, i) => i !== index));
  };

  const chartData = useMemo(() => {
    if (!datos) return [];
    const map = new Map<string, Record<string, string | number>>();
    datos.forEach((c) => {
      c.history.forEach((h) => {
        const fila = map.get(h.date) || { date: h.date };
        fila[c.coin] = Number(h.pct.toFixed(2));
        map.set(h.date, fila);
      });
    });
    return Array.from(map.values()).sort((x, y) =>
      String(x.date).localeCompare(String(y.date))
    );
  }, [datos]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        {seleccion.map((id, i) => (
          <div key={i} className="flex items-end gap-1">
            <Campo label={`Moneda ${i + 1}`}>
              <select
                value={id}
                onChange={(e) => actualizarSeleccion(i, e.target.value)}
                className={selectClase + " w-48"}
              >
                {MONEDAS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Campo>
            {seleccion.length > 2 && (
              <button
                onClick={() => quitarMoneda(i)}
                className="mb-0.5 w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-neutral-500 hover:text-[#f6465d] transition"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {seleccion.length < 4 && (
          <button
            onClick={agregarMoneda}
            className="mb-0.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition text-sm"
          >
            + Agregar
          </button>
        )}

        <Campo label="Período">
          <select value={dias} onChange={(e) => setDias(e.target.value)} className={selectClase + " w-32"}>
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {cargando && <p className="text-sm text-neutral-500">Comparando...</p>}
      {error && <p className="text-sm text-[#f6465d]">{error}</p>}

      {datos && !cargando && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            {datos.map((c, i) => (
              <div
                key={c.coin}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-w-[160px]"
              >
                <p className="text-xs text-neutral-500 mb-1" style={{ color: COLORES_COMPARADOR[i] }}>
                  {nombreCorto(c.coin)}
                </p>
                <p className="text-sm font-mono text-white">${formatPrice(c.currentPrice)}</p>
                <p className={`text-xs font-semibold ${c.changePct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                  {c.changePct >= 0 ? "+" : ""}
                  {c.changePct.toFixed(2)}% en el período
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#1f1f23" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} minTickGap={30} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickFormatter={(v) => `${v}%`}
                  width={45}
                />
                <Tooltip
                  contentStyle={{ background: "#111113", border: "1px solid #ffffff1a", fontSize: 12 }}
                  formatter={(value, name) => [`${Number(value)}%`, nombreCorto(String(name))]}
                />
                <Legend formatter={(name) => nombreCorto(name)} wrapperStyle={{ fontSize: 11 }} />
                {datos.map((c, i) => (
                  <Line
                    key={c.coin}
                    type="monotone"
                    dataKey={c.coin}
                    stroke={COLORES_COMPARADOR[i % COLORES_COMPARADOR.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-neutral-600 mt-3">
            El gráfico muestra el % de cambio de cada moneda desde el inicio del período (no el precio en
            dólares), para poder comparar monedas de precios muy distintos en la misma escala.
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
export default function HerramientasPage() {
  const [tab, setTab] = useState<Tab>("calculadora");

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-6 py-3.5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">InvestPanel</h1>
            <p className="text-neutral-500 text-[11px]">Herramientas para tus inversiones</p>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/ayuda" className="text-xs text-neutral-400 hover:text-white transition">
              Guía rápida
            </Link>
            <Link href="/graficos" className="text-xs text-neutral-400 hover:text-white transition">
              Ver gráficos
            </Link>
            <Link href="/" className="text-xs text-neutral-400 hover:text-white transition">
              ← Volver al panel
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          <TabBtn activo={tab === "calculadora"} onClick={() => setTab("calculadora")}>
            🧮 Calculadora de ganancias/pérdidas
          </TabBtn>
          <TabBtn activo={tab === "convertidor"} onClick={() => setTab("convertidor")}>
            💱 Convertidor de monedas
          </TabBtn>
          <TabBtn activo={tab === "comparador"} onClick={() => setTab("comparador")}>
            📊 Comparador de monedas
          </TabBtn>
        </div>

        {tab === "calculadora" && <CalculadoraPnL />}
        {tab === "convertidor" && <Convertidor />}
        {tab === "comparador" && <Comparador />}
      </div>
    </main>
  );
}
