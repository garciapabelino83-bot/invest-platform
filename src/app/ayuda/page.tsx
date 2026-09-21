import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guía rápida — InvestPanel",
  description:
    "Aprende a usar InvestPanel: cómo leer los gráficos, qué significa cada indicador y cómo activar avisos de precio.",
};

function Seccion({
  id,
  emoji,
  titulo,
  children,
}: {
  id: string;
  emoji: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 scroll-mt-20"
    >
      <h2 className="text-lg font-bold mb-3">
        {emoji} {titulo}
      </h2>
      <div className="text-slate-300 text-sm leading-relaxed flex flex-col gap-3">
        {children}
      </div>
    </section>
  );
}

function Indicador({ nombre, mide, cuando }: { nombre: string; mide: string; cuando: string }) {
  return (
    <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60">
      <p className="font-mono text-blue-400 font-semibold mb-1">{nombre}</p>
      <p className="text-slate-300 text-sm">
        <span className="text-slate-500">Qué mide: </span>
        {mide}
      </p>
      <p className="text-slate-300 text-sm mt-1">
        <span className="text-slate-500">Cómo usarlo: </span>
        {cuando}
      </p>
    </div>
  );
}

const INDICE = [
  { id: "mi-lista", label: "Mi lista (panel principal)" },
  { id: "etiquetas", label: "Qué significan las etiquetas de color" },
  { id: "velas", label: "Cómo leer un gráfico de velas" },
  { id: "mercados", label: "Acciones e índices (no solo cripto)" },
  { id: "indicadores", label: "Los indicadores, explicados sin tecnicismos" },
  { id: "avisos", label: "Marcar niveles y recibir avisos" },
  { id: "herramientas", label: "Herramientas: calculadora, convertidor y comparador" },
  { id: "plan-pro", label: "Plan Pro" },
];

export default function Ayuda() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📚 Guía rápida</h1>
            <p className="text-slate-400 text-sm">
              Todo lo que necesitas saber para usar InvestPanel, explicado sin tecnicismos
            </p>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition shrink-0">
            ← Volver al panel
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="bg-blue-950/30 border border-blue-900/40 rounded-2xl p-5 text-sm text-blue-200">
          ⚠️ Esta guía es solo para que entiendas cómo funciona la plataforma. Nada de lo que
          ves aquí (ni en InvestPanel) es una recomendación de inversión — los precios de
          cripto suben y bajan mucho, e inviertes bajo tu propio criterio.
        </div>

        <nav className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">En esta guía</p>
          <ul className="flex flex-col gap-2">
            {INDICE.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-blue-400 hover:underline text-sm">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Seccion id="mi-lista" emoji="📊" titulo="Mi lista (panel principal)">
          <p>
            Cuando entras a InvestPanel, lo primero que ves es <strong>&quot;Mi lista&quot;</strong>:
            una fila por cada moneda que estás siguiendo, con su precio actual, cuánto subió
            o bajó en las últimas 24 horas, y un mini análisis técnico automático (RSI y
            tendencia).
          </p>
          <p>
            Para agregar una moneda, dale a <strong>&quot;+ Agregar moneda&quot;</strong> arriba a la
            derecha y busca por nombre o símbolo (por ejemplo &quot;pepe&quot; o &quot;btc&quot;). Para
            quitar una, dale a la ✕ al final de su fila. Tu lista se guarda sola en tu
            navegador, así que la próxima vez que entres seguirá ahí.
          </p>
        </Seccion>

        <Seccion id="etiquetas" emoji="🏷️" titulo="Qué significan las etiquetas de color">
          <p>Cada fila trae unas etiquetas que resumen el análisis técnico en una sola palabra:</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-3">
              <p className="text-red-400 font-semibold text-sm">Sobrecompra — posible caída</p>
              <p className="text-xs text-slate-400 mt-1">
                El precio subió mucho y muy rápido. Históricamente, después de una subida así
                suele venir una pausa o una corrección.
              </p>
            </div>
            <div className="border border-green-500/30 bg-green-500/10 rounded-xl p-3">
              <p className="text-green-400 font-semibold text-sm">Sobreventa — posible rebote</p>
              <p className="text-xs text-slate-400 mt-1">
                El precio bajó mucho y muy rápido. Suele ser la zona donde el precio hace una
                pausa o rebota un poco.
              </p>
            </div>
            <div className="border border-green-500/30 bg-green-500/10 rounded-xl p-3">
              <p className="text-green-400 font-semibold text-sm">Tendencia alcista</p>
              <p className="text-xs text-slate-400 mt-1">
                El promedio de los últimos 7 días está por encima del promedio de los últimos
                30 días — el precio, en general, viene subiendo.
              </p>
            </div>
            <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-3">
              <p className="text-red-400 font-semibold text-sm">Tendencia bajista</p>
              <p className="text-xs text-slate-400 mt-1">
                Lo contrario: el promedio reciente está por debajo del promedio de 30 días — el
                precio, en general, viene bajando.
              </p>
            </div>
          </div>
        </Seccion>

        <Seccion id="velas" emoji="🕯️" titulo="Cómo leer un gráfico de velas">
          <p>
            Dale a <strong>&quot;📈 Ver gráficos&quot;</strong> desde el panel para entrar a la vista
            de gráficos, donde puedes buscar cualquier moneda de las más de 200 disponibles y
            elegir la temporalidad (desde 1 segundo hasta 1 año).
          </p>
          <p>
            Cada &quot;vela&quot; representa el movimiento del precio durante un período de tiempo
            (por ejemplo, un día si elegiste &quot;1 día&quot;):
          </p>
          <ul className="list-disc list-inside flex flex-col gap-1">
            <li>
              <span className="text-green-400 font-semibold">Vela verde</span>: el precio cerró
              más alto de lo que abrió (subió en ese período).
            </li>
            <li>
              <span className="text-red-400 font-semibold">Vela roja</span>: el precio cerró más
              bajo de lo que abrió (bajó en ese período).
            </li>
            <li>
              El <strong>cuerpo</strong> (la parte ancha) muestra el precio de apertura y cierre.
              Las <strong>mechas</strong> (las líneas finas arriba y abajo) muestran el precio
              más alto y más bajo que se tocó en ese período.
            </li>
          </ul>
        </Seccion>

        <Seccion id="mercados" emoji="🏦" titulo="Acciones e índices (no solo cripto)">
          <p>
            Arriba del gráfico hay dos pestañas: <strong>&quot;Cripto&quot;</strong> y{" "}
            <strong>&quot;Acciones e índices&quot;</strong>. En la segunda puedes seguir el S&amp;P
            500, el Dow Jones, el Nasdaq, y otros índices bursátiles importantes (IBEX, DAX,
            CAC 40, FTSE, Nikkei, Hang Seng, entre otros), además de acciones conocidas como
            Apple, Microsoft, Amazon, Nvidia o Tesla.
          </p>
          <p className="text-slate-500 text-xs">
            Los mercados de acciones no operan las 24 horas como la cripto (cierran de noche y
            los fines de semana), así que fuera de horario de mercado vas a ver el último precio
            de cierre en vez de uno que se mueve en vivo.
          </p>
        </Seccion>

        <Seccion id="indicadores" emoji="🧮" titulo="Los indicadores, explicados sin tecnicismos">
          <p>
            Arriba del gráfico de velas puedes activar y desactivar distintos indicadores.
            Aquí está qué hace cada uno, en español simple:
          </p>
          <div className="grid gap-3">
            <Indicador
              nombre="MA — Media móvil simple (7 y 30)"
              mide="El precio promedio de los últimos 7 y 30 períodos."
              cuando="Cuando la línea de 7 cruza por encima de la de 30, suele leerse como señal de que la tendencia está cambiando a alcista (y viceversa)."
            />
            <Indicador
              nombre="EMA — Media móvil exponencial (12 y 26)"
              mide="Parecido a la MA, pero le da más peso a los precios recientes, así que reacciona más rápido a los cambios."
              cuando="Útil si quieres detectar un cambio de tendencia un poco antes que con la MA normal."
            />
            <Indicador
              nombre="BOLL — Bandas de Bollinger (20, 2)"
              mide="Una banda alrededor del precio que se ensancha cuando hay mucha volatilidad y se achica cuando el precio está tranquilo."
              cuando="Cuando el precio toca la banda de arriba, se suele leer como &quot;caro&quot; en el corto plazo; cuando toca la de abajo, como &quot;barato&quot;."
            />
            <Indicador
              nombre="VOL — Volumen"
              mide="Cuánto se compró y vendió de esa moneda en cada período."
              cuando="Un movimiento de precio con mucho volumen suele ser más confiable que uno con poco volumen."
            />
            <Indicador
              nombre="RSI — Índice de fuerza relativa (14)"
              mide="Qué tan rápido y qué tanto subió o bajó el precio recientemente, en una escala de 0 a 100."
              cuando="Arriba de 70 se considera &quot;sobrecompra&quot;, abajo de 30 se considera &quot;sobreventa&quot; (los mismos términos que ves en las filas de Mi lista)."
            />
            <Indicador
              nombre="MACD (12, 26, 9)"
              mide="La diferencia entre dos medias móviles, para detectar cambios de impulso en el precio."
              cuando="Cuando la línea MACD cruza por encima de su señal, se suele leer como señal de compra; cuando cruza por debajo, como señal de venta."
            />
            <Indicador
              nombre="KDJ (9, 3, 3)"
              mide="Parecido al RSI: compara el precio de cierre contra el rango de precios reciente."
              cuando="Se usa igual que el RSI, para detectar zonas de sobrecompra y sobreventa, pero suele moverse un poco más rápido."
            />
            <Indicador
              nombre="WR — Williams %R (14)"
              mide="Otra forma de medir sobrecompra/sobreventa, en una escala invertida (0 a -100)."
              cuando="Cerca de 0 se considera sobrecompra; cerca de -100, sobreventa."
            />
          </div>
          <p className="text-slate-500 text-xs">
            No hace falta que actives todos a la vez — la mayoría de la gente usa uno o dos
            (por ejemplo MA + RSI) para no saturar el gráfico.
          </p>
        </Seccion>

        <Seccion id="avisos" emoji="🔔" titulo="Marcar niveles y recibir avisos">
          <p>
            A la izquierda de cada gráfico hay una barra de herramientas de dibujo. El ícono de
            la línea (◆—◆) es para <strong>marcar soporte/resistencia</strong>: actívalo y haz
            clic sobre el precio donde quieres poner una línea horizontal. Con la línea puesta,
            dale al ícono 🔔 para que InvestPanel te mande una notificación a tu navegador cuando
            el precio llegue ahí — así no tienes que quedarte mirando la pantalla.
          </p>
          <p>
            Los otros dos íconos de esa misma barra son para dibujar sobre el gráfico: una{" "}
            <strong>línea de tendencia</strong> (haz clic en un punto y luego en otro, para
            trazar la línea entre ambos) y un <strong>retroceso de Fibonacci</strong> (haz clic
            en un máximo y luego en un mínimo del precio, y InvestPanel dibuja automáticamente
            los 7 niveles que usan los traders para ubicar posibles zonas de rebote). Con el
            ícono de la papelera borras todo lo que hayas dibujado.
          </p>
          <p className="text-slate-500 text-xs">
            Los avisos automáticos de precio (🔔) son una función del Plan Pro (ver abajo); las
            líneas de tendencia y Fibonacci están disponibles para todos.
          </p>
        </Seccion>

        <Seccion id="herramientas" emoji="🧮" titulo="Herramientas: calculadora, convertidor y comparador">
          <p>
            Desde el menú superior entra a <strong>&quot;🧮 Herramientas&quot;</strong> para usar tres
            ayudas extra, sin necesidad de Plan Pro:
          </p>
          <p>
            <strong>Calculadora de ganancias/pérdidas:</strong> escribe tu precio de entrada, de
            salida y cuánto invertiste (en compra o en venta en corto), y te muestra cuánto
            ganarías o perderías, ya restando una comisión aproximada.
          </p>
          <p>
            <strong>Convertidor de monedas:</strong> convierte entre criptomonedas y monedas
            como dólar, euro o pesos latinoamericanos, con precios actualizados.
          </p>
          <p>
            <strong>Comparador de monedas:</strong> elige 2 a 4 monedas y un período (7 días, 30
            días, etc.) para ver, en un mismo gráfico, cuál subió o bajó más en porcentaje.
          </p>
        </Seccion>

        <Seccion id="plan-pro" emoji="🔓" titulo="Plan Pro">
          <p>
            El Plan Pro cuesta <strong>$9.99 USD/mes</strong> (con 7 días de prueba gratis) y
            desbloquea los avisos automáticos de precio y las próximas funciones que se vayan
            agregando a la plataforma. Lo activas desde el botón &quot;Plan Pro&quot; en el panel
            principal, con tu correo.
          </p>
        </Seccion>

        <p className="text-center text-slate-500 text-xs pt-2">
          ¿Sigues con dudas?{" "}
          <Link href="/" className="text-blue-400 hover:underline">
            Vuelve al panel
          </Link>{" "}
          y prueba agregando una moneda — es la mejor forma de aprender.
        </p>
      </div>
    </main>
  );
}
