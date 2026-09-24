import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Genera la imagen de fondo del Reel (formato vertical 9:16), en el
// mismo estilo que la tarjeta de Facebook pero pensada para pantalla
// completa de celular. Se renderiza a 2x de resolucion (2160x3840) para
// que el efecto de zoom lento en el video no se vea pixelado.
//
// Genera DOS variantes del mismo diseno (identicas salvo por la zona del
// grafico): una "vacia" (solo una cuadricula tenue) y otra "completa" (con
// las velas japonesas ya dibujadas). El script que arma el video usa las
// dos para animar una revelacion de izquierda a derecha, simulando que el
// grafico de velas "se dibuja" y sube/baja en vivo.

let fontCache = null;
async function loadFontsBase64() {
  if (fontCache) return fontCache;
  const dir = path.join(__dirname, "fonts");
  const [bold, medium, regular] = await Promise.all([
    readFile(path.join(dir, "Poppins-Bold.ttf")),
    readFile(path.join(dir, "Poppins-Medium.ttf")),
    readFile(path.join(dir, "Poppins-Regular.ttf")),
  ]);
  fontCache = {
    bold: bold.toString("base64"),
    medium: medium.toString("base64"),
    regular: regular.toString("base64"),
  };
  return fontCache;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Pequena etiqueta con fondo solido, para que el texto se siga leyendo
// bien aunque una mecha de vela (u otra linea) pase por detras.
function labelPill(x, y, text, { fontSize = 32, color = "#ffffff", anchor = "start" } = {}) {
  const charW = fontSize * 0.6;
  const textW = text.length * charW;
  const padX = 16;
  const boxH = fontSize * 1.5;
  let boxX;
  if (anchor === "end") boxX = x - textW - padX;
  else if (anchor === "middle") boxX = x - textW / 2 - padX;
  else boxX = x - padX;
  const boxW = textW + padX * 2;
  const boxY = y - fontSize * 1.05;
  return (
    `<rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="10" fill="#05060a" fill-opacity="0.78"/>` +
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontSize}" font-weight="700" fill="${color}" text-anchor="${anchor}">${escapeXml(text)}</text>`
  );
}

function formatUSD(n) {
  if (n === null || n === undefined) return "N/D";
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

const COIN_COLORS = {
  bitcoin: ["#f7931a", "#c2680a"],
  ethereum: ["#8fa3ff", "#525ea8"],
  solana: ["#9945ff", "#14f195"],
  ripple: ["#4f6bff", "#1c2340"],
  dogecoin: ["#e8c14a", "#a68221"],
  cardano: ["#3a6ff5", "#1e3a8a"],
  binancecoin: ["#f3ba2f", "#a97a12"],
  "avalanche-2": ["#e84142", "#8a1315"],
  chainlink: ["#4a7ff7", "#1c3f9c"],
  polkadot: ["#ff2fb1", "#96155f"],
};
const DEFAULT_COLORS = ["#60a5fa", "#4338ca"];

const RSI_COLORS = {
  sobrecompra: { bg: "#3a1418", fg: "#ff7a7a", label: "Sobrecompra" },
  sobreventa: { bg: "#0f2e1d", fg: "#4ade80", label: "Sobreventa" },
  neutral: { bg: "#332a0c", fg: "#facc15", label: "Neutral" },
};

const TREND_COLORS = {
  alcista: { fg: "#4ade80", label: "Alcista" },
  bajista: { fg: "#ff7a7a", label: "Bajista" },
};

// Convierte el historial de precios (cierres) en velas japonesas
// sinteticas: open = cierre anterior, close = cierre actual, y una mecha
// (high/low) proporcional al movimiento, para que se vea como un grafico
// de trading real que sube y baja.
function computeCandles(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const closes = history.slice(-24).map((p) => p.price);
  const globalRange = Math.max(...closes) - Math.min(...closes) || 1;

  return closes.map((close, i) => {
    const open = i === 0 ? closes[0] : closes[i - 1];
    const isUp = close >= open;
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const wick = Math.max(Math.abs(close - open) * 0.7, globalRange * 0.03);
    return { open, close, high: bodyTop + wick, low: bodyBottom - wick, bodyTop, bodyBottom, isUp };
  });
}

function makeScaleY(candles, y, h) {
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const range = max - min || 1;
  return (v) => y + h - ((v - min) / range) * h;
}

// Calcula, a partir de las mismas velas sinteticas que se dibujan en la
// tarjeta, los niveles de soporte/resistencia y una posible zona de
// Volume Imbalance (VI) — el mismo concepto que ya explicamos en el
// dashboard de InvestPanel (hueco entre el cuerpo de una vela y el de la
// vela dos posiciones despues, en la misma direccion, sin contar la
// mecha). Se calcula una sola vez y se reutiliza tanto para dibujarlo en
// el video como para mencionarlo en la descripcion del Reel, asi el
// video y el texto siempre coinciden.
function computeChartInsights(history) {
  const candles = computeCandles(history);
  if (!candles || candles.length < 3) {
    return { candles, support: null, resistance: null, vi: null };
  }

  // Soporte/resistencia: minimo y maximo de la estructura previa (sin
  // contar las ultimas 3 velas), para que representen niveles anteriores
  // que el precio mas reciente podria estar retesteando, en vez de
  // simplemente el extremo de la ultima vela.
  const structural = candles.length > 6 ? candles.slice(0, -3) : candles;
  const resistance = Math.max(...structural.map((c) => c.bodyTop));
  const support = Math.min(...structural.map((c) => c.bodyBottom));

  // Volume Imbalance: se busca, entre todas las velas, el hueco mas
  // grande entre el cuerpo de una vela y el cuerpo de la vela dos
  // posiciones despues (misma direccion). Si no hay ningun hueco por
  // encima del umbral minimo, no se marca ninguna zona — no se inventa.
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const range = max - min || 1;
  const minGap = range * 0.05;

  let vi = null;
  for (let i = 0; i < candles.length - 2; i++) {
    const a = candles[i];
    const c = candles[i + 2];
    const gapUp = c.bodyBottom - a.bodyTop;
    const gapDown = a.bodyBottom - c.bodyTop;
    if (gapUp > minGap && (!vi || gapUp > vi.gap)) {
      vi = { i, gap: gapUp, bias: "alcista", zoneLow: a.bodyTop, zoneHigh: c.bodyBottom };
    }
    if (gapDown > minGap && (!vi || gapDown > vi.gap)) {
      vi = { i, gap: gapDown, bias: "bajista", zoneLow: c.bodyTop, zoneHigh: a.bodyBottom };
    }
  }

  return { candles, support, resistance, vi };
}

// --- Estructura de mercado estilo SMC (Smart Money Concepts) ---
//
// Ademas del soporte/resistencia y la zona VI de mas arriba, se calcula
// una lectura de estructura mas completa sobre las mismas velas:
// swing highs/lows, un BOS (Break of Structure — el precio rompiendo un
// maximo o minimo previo), el Order Block que origino ese movimiento, un
// nivel de liquidez (un swing anterior, todavia no visitado, donde se
// acumulan stops) y una entrada con relacion riesgo/beneficio (RR) hacia
// el otro extremo del rango. Todo esto sale de los precios reales — si
// no hay una ruptura clara, simplemente no se dibuja nada de esto.
function findSwingPoints(candles, k = 2) {
  const highs = [];
  const lows = [];
  for (let i = k; i < candles.length - k; i++) {
    const windowSlice = candles.slice(i - k, i + k + 1);
    if (candles[i].high === Math.max(...windowSlice.map((c) => c.high))) {
      highs.push({ index: i, price: candles[i].high });
    }
    if (candles[i].low === Math.min(...windowSlice.map((c) => c.low))) {
      lows.push({ index: i, price: candles[i].low });
    }
  }
  return { highs, lows };
}

function computeSmcStructure(candles) {
  if (!candles || candles.length < 10) return null;
  const { highs, lows } = findSwingPoints(candles, 2);
  if (highs.length === 0 || lows.length === 0) return null;

  // El BOS mas reciente: la primera vela que cierra mas alla de un swing
  // high (ruptura alcista) o de un swing low (ruptura bajista) anterior.
  let bestBos = null;
  for (const sh of highs) {
    for (let j = sh.index + 1; j < candles.length; j++) {
      if (candles[j].close > sh.price) {
        const candidate = { bias: "alcista", price: sh.price, swingIndex: sh.index, breakIndex: j };
        if (!bestBos || candidate.breakIndex > bestBos.breakIndex) bestBos = candidate;
        break;
      }
    }
  }
  for (const sl of lows) {
    for (let j = sl.index + 1; j < candles.length; j++) {
      if (candles[j].close < sl.price) {
        const candidate = { bias: "bajista", price: sl.price, swingIndex: sl.index, breakIndex: j };
        if (!bestBos || candidate.breakIndex > bestBos.breakIndex) bestBos = candidate;
        break;
      }
    }
  }
  if (!bestBos) return null;

  const isBull = bestBos.bias === "alcista";

  // Order Block: la ultima vela contraria al impulso, justo antes de que
  // arranque el movimiento que provoco la ruptura.
  let obIndex = bestBos.breakIndex - 1;
  while (obIndex > 0 && candles[obIndex].isUp === isBull) obIndex--;
  const ob = candles[obIndex];
  const orderBlock = {
    index: obIndex,
    top: Math.max(ob.open, ob.close),
    bottom: Math.min(ob.open, ob.close),
  };

  // Liquidez: un swing anterior al Order Block, mas alla de su zona — un
  // nivel que el precio todavia no toco, donde se acumulan ordenes de
  // stop loss.
  let liquidity;
  if (isBull) {
    const priorLows = lows.filter((l) => l.index < obIndex && l.price < orderBlock.bottom);
    liquidity = {
      price: priorLows.length ? Math.min(...priorLows.map((l) => l.price)) : Math.min(...candles.map((c) => c.low)),
    };
  } else {
    const priorHighs = highs.filter((hh) => hh.index < obIndex && hh.price > orderBlock.top);
    liquidity = {
      price: priorHighs.length ? Math.max(...priorHighs.map((hh) => hh.price)) : Math.max(...candles.map((c) => c.high)),
    };
  }

  // Entrada / stop / objetivo / RR, para dibujar la flecha de la
  // operacion, igual que en un plan de trading real.
  const entryPrice = isBull ? orderBlock.top : orderBlock.bottom;
  const stopPrice = liquidity.price;
  const targetPrice = isBull ? Math.max(...candles.map((c) => c.high)) : Math.min(...candles.map((c) => c.low));
  const risk = Math.abs(entryPrice - stopPrice);
  const reward = Math.abs(targetPrice - entryPrice);
  const rr = risk > 0 ? reward / risk : null;

  return {
    bias: bestBos.bias,
    bos: { price: bestBos.price, swingIndex: bestBos.swingIndex, breakIndex: bestBos.breakIndex },
    orderBlock,
    liquidity,
    entry: { entryPrice, stopPrice, targetPrice, rr },
  };
}

function buildCandlesSvg(candles, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const bodyWidth = Math.max(slot * 0.5, 8);

  return candles
    .map((c, i) => {
      const cx = x + slot * (i + 0.5);
      const color = c.isUp ? "#4ade80" : "#ff7a7a";
      const yHigh = scaleY(c.high);
      const yLow = scaleY(c.low);
      const yTop = scaleY(c.bodyTop);
      const yBottom = scaleY(c.bodyBottom);
      const bodyH = Math.max(yBottom - yTop, 8);
      return (
        `<line x1="${cx.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="6"/>` +
        `<rect x="${(cx - bodyWidth / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${bodyWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="5" fill="${color}"/>`
      );
    })
    .join("");
}

// Lineas punteadas de soporte (verde) y resistencia (roja) sobre el
// grafico, con su precio, dibujadas detras de las velas.
function buildLevelsSvg(candles, insights, x, y, w, h) {
  if (!insights || insights.support === null || insights.resistance === null) return "";
  const scaleY = makeScaleY(candles, y, h);

  const line = (value, color, label) => {
    const ly = scaleY(value);
    const ty = ly - 16 > y ? ly - 16 : ly + 40;
    return (
      `<line x1="${x}" y1="${ly.toFixed(1)}" x2="${x + w}" y2="${ly.toFixed(1)}" stroke="${color}" stroke-width="4" stroke-dasharray="14 12" opacity="0.85"/>` +
      `<text x="${x + w}" y="${ty.toFixed(1)}" font-size="38" font-weight="600" fill="${color}" text-anchor="end">${label} ${escapeXml(formatUSD(value))}</text>`
    );
  };

  return line(insights.resistance, "#ff7a7a", "Resistencia") + line(insights.support, "#4ade80", "Soporte");
}

// Zona de Volume Imbalance: un rectangulo punteado semitransparente
// detras de las velas que la formaron, con una pequena etiqueta "VI".
function buildViSvg(candles, insights, x, y, w, h) {
  if (!insights || !insights.vi) return "";
  const { i, bias, zoneLow, zoneHigh } = insights.vi;
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const xStart = x + slot * i;
  const xEnd = x + slot * (i + 3);
  const yTop = scaleY(zoneHigh);
  const yBottom = scaleY(zoneLow);
  const rectH = Math.max(yBottom - yTop, 6);
  const color = bias === "alcista" ? "#4ade80" : "#ff7a7a";

  return `<rect x="${xStart.toFixed(1)}" y="${yTop.toFixed(1)}" width="${(xEnd - xStart).toFixed(1)}" height="${rectH.toFixed(1)}" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="3" stroke-dasharray="10 8"/>`;
}

// Etiqueta "VI" de la zona de Volume Imbalance — se dibuja aparte, encima
// de las velas, para que nunca quede tapada por una mecha.
function buildViLabelSvg(candles, insights, x, y, w, h) {
  if (!insights || !insights.vi) return "";
  const { i, bias, zoneLow, zoneHigh } = insights.vi;
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const xStart = x + slot * i;
  const yTop = scaleY(zoneHigh);
  const yBottom = scaleY(zoneLow);
  const color = bias === "alcista" ? "#4ade80" : "#ff7a7a";
  return labelPill(xStart + 14, yTop + (yBottom - yTop) / 2 + 12, "VI", { fontSize: 34, color });
}

// Linea de BOS (Break of Structure): el nivel del swing que se rompio,
// dibujada solo entre ese swing y la vela que lo rompio (no en toda la
// pantalla), para que se lea como "aqui se rompio la estructura".
function buildBosSvg(candles, structure, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const { swingIndex, breakIndex, price } = structure.bos;
  const color = "#facc15";
  const xStart = x + slot * (swingIndex + 0.5);
  const xEnd = x + slot * (breakIndex + 1);
  const ly = scaleY(price);

  return `<line x1="${xStart.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${xEnd.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${color}" stroke-width="4" stroke-dasharray="16 10"/>`;
}

function buildBosLabelSvg(candles, structure, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const { swingIndex, price } = structure.bos;
  const color = "#facc15";
  const xStart = x + slot * (swingIndex + 0.5);
  const ly = scaleY(price);
  const labelY = ly - 18 > y ? ly - 18 : ly + 44;
  return labelPill(xStart, labelY, "BOS", { fontSize: 34, color });
}

// Order Block (banda oscura y delgada) y Zona de Demanda/Oferta (banda
// azul o roja, mas ancha, que se extiende hacia la derecha porque sigue
// "vigente"). Es la misma zona que dibuja la referencia: el Order Block
// justo pegado a la Zona de Demanda/Oferta.
function buildZonesSvg(candles, structure, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const isBull = structure.bias === "alcista";
  const { index, top, bottom } = structure.orderBlock;

  const xStart = x + slot * index;
  const xEnd = x + w;
  const yTop = scaleY(top);
  const yBottom = scaleY(bottom);
  const obH = Math.max(yBottom - yTop, 10);

  const zoneColor = isBull ? "#4f8fff" : "#ff7a7a";
  // La zona de demanda/oferta se dibuja un poco mas ancha que el order
  // block puntual, para que se lea como una franja de precio.
  const zonePad = Math.max(h * 0.03, 14);
  const zoneTop = isBull ? yTop : yTop - zonePad;
  const zoneH = obH + zonePad;

  return (
    `<rect x="${xStart.toFixed(1)}" y="${zoneTop.toFixed(1)}" width="${(xEnd - xStart).toFixed(1)}" height="${zoneH.toFixed(1)}" fill="${zoneColor}" fill-opacity="0.14" stroke="${zoneColor}" stroke-width="3"/>` +
    `<rect x="${xStart.toFixed(1)}" y="${yTop.toFixed(1)}" width="${Math.min(xEnd - xStart, slot * 3).toFixed(1)}" height="${obH.toFixed(1)}" fill="#9aa0ad" fill-opacity="0.22" stroke="#9aa0ad" stroke-width="2.5"/>`
  );
}

// Etiquetas "Zona de Demanda/Oferta" y "Order Block" — se dibujan aparte,
// encima de las velas, con fondo solido, para que nunca queden tapadas
// por una mecha (el bug que se vio en la prueba local).
function buildZonesLabelsSvg(candles, structure, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const isBull = structure.bias === "alcista";
  const { index, top, bottom } = structure.orderBlock;

  const xStart = x + slot * index;
  const yTop = scaleY(top);
  const yBottom = scaleY(bottom);
  const obH = Math.max(yBottom - yTop, 10);

  const zoneColor = isBull ? "#4f8fff" : "#ff7a7a";
  const zoneLabel = isBull ? "Zona de Demanda" : "Zona de Oferta";
  const zonePad = Math.max(h * 0.03, 14);
  const zoneTop = isBull ? yTop : yTop - zonePad;
  const zoneH = obH + zonePad;

  return (
    labelPill(xStart + 14, zoneTop + zoneH + 40, zoneLabel, { fontSize: 34, color: zoneColor }) +
    labelPill(xStart + 14, yTop - 14, "Order Block", { fontSize: 30, color: "#c7cad1" })
  );
}

// Linea de liquidez: un nivel mas alla de la zona de demanda/oferta,
// todavia no visitado por el precio, donde se acumulan stops — el "cebo"
// del stop-loss hunting.
function buildLiquiditySvg(candles, structure, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const ly = scaleY(structure.liquidity.price);
  const color = "#e2e4e9";

  return `<line x1="${x}" y1="${ly.toFixed(1)}" x2="${x + w}" y2="${ly.toFixed(1)}" stroke="${color}" stroke-width="3" stroke-dasharray="6 10" opacity="0.8"/>`;
}

function buildLiquidityLabelSvg(candles, structure, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const ly = scaleY(structure.liquidity.price);
  const isBull = structure.bias === "alcista";
  const labelY = isBull ? ly + 44 : ly - 18;
  const color = "#e2e4e9";
  return labelPill(x + w - 14, labelY, "Liquidez", { fontSize: 32, color, anchor: "end" });
}

// Flecha de entrada hacia el objetivo, con la relacion riesgo/beneficio
// (RR), igual que en un plan de trade real: desde el Order Block hasta
// el otro extremo del rango.
function buildEntryArrowSvg(candles, structure, x, y, w, h) {
  const scaleY = makeScaleY(candles, y, h);
  const n = candles.length;
  const slot = w / n;
  const isBull = structure.bias === "alcista";
  const { entryPrice, targetPrice, rr } = structure.entry;

  const xStart = x + slot * (structure.orderBlock.index + 2);
  const xEnd = x + w - 40;
  const yStart = scaleY(entryPrice);
  const yEnd = scaleY(targetPrice);
  const color = isBull ? "#4ade80" : "#ff7a7a";
  const markerId = isBull ? "arrowHeadUp" : "arrowHeadDown";
  const midX = (xStart + xEnd) / 2;
  const midY = (yStart + yEnd) / 2;
  const rrLabel = rr !== null ? `RR ${rr.toFixed(1)}` : "";

  return (
    `<line x1="${xStart.toFixed(1)}" y1="${yStart.toFixed(1)}" x2="${xEnd.toFixed(1)}" y2="${yEnd.toFixed(1)}" stroke="${color}" stroke-width="5" stroke-dasharray="4 10" marker-end="url(#${markerId})"/>` +
    (rrLabel
      ? `<rect x="${(midX - 90).toFixed(1)}" y="${(midY - 60).toFixed(1)}" width="180" height="72" rx="16" fill="#0a0b0e" stroke="${color}" stroke-width="2.5"/>` +
        `<text x="${midX.toFixed(1)}" y="${(midY - 14).toFixed(1)}" font-size="38" font-weight="700" fill="${color}" text-anchor="middle">${rrLabel}</text>`
      : "")
  );
}

// Cuadricula tenue que ocupa el mismo espacio que las velas, para que la
// variante "vacia" no se vea como un hueco sino como un grafico esperando
// a dibujarse.
function buildGrid(x, y, w, h) {
  const rows = 4;
  let lines = "";
  for (let i = 0; i <= rows; i++) {
    const ly = y + (h / rows) * i;
    lines += `<line x1="${x}" y1="${ly.toFixed(1)}" x2="${x + w}" y2="${ly.toFixed(1)}" stroke="#1c1d21" stroke-width="3" stroke-dasharray="16 18"/>`;
  }
  return lines;
}

// Arma el contenido del grafico para una "etapa" concreta de la
// revelacion progresiva del video: "empty" (solo cuadricula), "candles"
// (velas solas, sin nada de SMC todavia), "bos", "zones", "liquidity" y
// "full" van agregando, en ese orden, cada elemento de la estructura SMC
// (cada uno se queda ya dibujado en las etapas siguientes). Si no se
// detecto una ruptura de estructura clara, se usa el diseno anterior
// (soporte/resistencia + VI) desde la primera etapa con velas, sin
// escalonarlo, porque no hay elementos separados que ir revelando.
function buildChartContent(insights, structure, stage, chartX, chartY, chartW, chartH) {
  if (stage === "empty" || !insights.candles) {
    return buildGrid(chartX, chartY, chartW, chartH);
  }

  if (!structure) {
    return (
      buildLevelsSvg(insights.candles, insights, chartX, chartY, chartW, chartH) +
      buildViSvg(insights.candles, insights, chartX, chartY, chartW, chartH) +
      buildCandlesSvg(insights.candles, chartX, chartY, chartW, chartH) +
      buildViLabelSvg(insights.candles, insights, chartX, chartY, chartW, chartH)
    );
  }

  const order = ["candles", "bos", "zones", "liquidity", "full"];
  const level = Math.max(order.indexOf(stage), 0);
  const includeBos = level >= order.indexOf("bos");
  const includeZones = level >= order.indexOf("zones");
  const includeLiquidity = level >= order.indexOf("liquidity");
  const includeEntry = level >= order.indexOf("full");

  let shapes = buildViSvg(insights.candles, insights, chartX, chartY, chartW, chartH);
  if (includeZones) shapes += buildZonesSvg(insights.candles, structure, chartX, chartY, chartW, chartH);
  if (includeBos) shapes += buildBosSvg(insights.candles, structure, chartX, chartY, chartW, chartH);
  if (includeLiquidity) shapes += buildLiquiditySvg(insights.candles, structure, chartX, chartY, chartW, chartH);

  let labels = buildViLabelSvg(insights.candles, insights, chartX, chartY, chartW, chartH);
  if (includeBos) labels += buildBosLabelSvg(insights.candles, structure, chartX, chartY, chartW, chartH);
  if (includeZones) labels += buildZonesLabelsSvg(insights.candles, structure, chartX, chartY, chartW, chartH);
  if (includeLiquidity) labels += buildLiquidityLabelSvg(insights.candles, structure, chartX, chartY, chartW, chartH);

  const entry = includeEntry
    ? buildEntryArrowSvg(insights.candles, structure, chartX, chartY, chartW, chartH)
    : "";

  return shapes + buildCandlesSvg(insights.candles, chartX, chartY, chartW, chartH) + labels + entry;
}

function buildCardSvg(coin, data, { stage }) {
  return loadFontsBase64().then((fonts) => {
    const W = 2160;
    const H = 3840;
    const pad = 128;
    const chartX = pad;
    const chartY = 1200;
    const chartW = W - pad * 2;
    const chartH = 1900;

    const price = formatUSD(data.currentPrice);
    const rsiInfo = data.rsiSignal ? RSI_COLORS[data.rsiSignal] : null;
    const rsiValue = data.rsi !== null && data.rsi !== undefined ? data.rsi.toFixed(1) : "N/D";
    const trendInfo = data.trend ? TREND_COLORS[data.trend] : null;
    const [c1, c2] = COIN_COLORS[coin.id] || DEFAULT_COLORS;

    const history = Array.isArray(data.history) ? data.history.slice(-30) : [];
    let changePct = null;
    if (history.length >= 2) {
      const first = history[0].price;
      const last = history[history.length - 1].price;
      if (first) changePct = ((last - first) / first) * 100;
    }
    const changeColor = changePct === null ? "#8a8d93" : changePct >= 0 ? "#4ade80" : "#ff7a7a";
    const changeLabel =
      changePct === null ? "" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% en 30 dias`;

    const insights = computeChartInsights(history);
    const structure = insights.candles ? computeSmcStructure(insights.candles) : null;
    const chartContent = buildChartContent(insights, structure, stage, chartX, chartY, chartW, chartH);

    const bannerText = structure
      ? `ESTRUCTURA SMC · BOS + ORDER BLOCK · SESGO ${structure.bias.toUpperCase()}`
      : "ESTRUCTURA DE MERCADO (SMC)";
    const bannerColor = structure ? (structure.bias === "alcista" ? "#4ade80" : "#ff7a7a") : "#8a8d93";

    const initials = escapeXml(coin.symbol.slice(0, 4));

    return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face { font-family: 'Poppins'; font-weight: 700; src: url(data:font/ttf;base64,${fonts.bold}) format('truetype'); }
      @font-face { font-family: 'Poppins'; font-weight: 600; src: url(data:font/ttf;base64,${fonts.medium}) format('truetype'); }
      @font-face { font-family: 'Poppins'; font-weight: 400; src: url(data:font/ttf;base64,${fonts.regular}) format('truetype'); }
      text { font-family: 'Poppins', 'Arial', sans-serif; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#111319"/>
      <stop offset="55%" stop-color="#0a0b0e"/>
      <stop offset="100%" stop-color="#050506"/>
    </linearGradient>
    <radialGradient id="glow" cx="20%" cy="14%" r="45%">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="coinBadge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <marker id="arrowHeadUp" markerWidth="14" markerHeight="14" refX="6" refY="10" orient="auto">
      <path d="M0,10 L6,0 L12,10 Z" fill="#4ade80"/>
    </marker>
    <marker id="arrowHeadDown" markerWidth="14" markerHeight="14" refX="6" refY="4" orient="auto">
      <path d="M0,4 L6,14 L12,4 Z" fill="#ff7a7a"/>
    </marker>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Header -->
  <rect x="${pad}" y="150" width="70" height="70" rx="18" fill="url(#coinBadge)"/>
  <text x="${pad + 92}" y="205" font-size="68" font-weight="700" fill="#ffffff">InvestPanel</text>
  <line x1="${pad}" y1="270" x2="${W - pad}" y2="270" stroke="#1c1d21" stroke-width="4"/>

  <!-- Coin -->
  <rect x="${pad}" y="360" width="260" height="260" rx="60" fill="url(#coinBadge)"/>
  <text x="${pad + 130}" y="510" font-size="88" font-weight="700" fill="#0a0a0b" text-anchor="middle">${initials}</text>
  <text x="${pad + 300}" y="450" font-size="104" font-weight="700" fill="#ffffff">${escapeXml(coin.name)}</text>
  <text x="${pad + 300}" y="530" font-size="58" font-weight="400" fill="#8a8d93">${escapeXml(coin.symbol)} / USD &#183; Analisis tecnico</text>

  <!-- Price -->
  <text x="${pad}" y="700" font-size="46" font-weight="600" fill="#71747c" letter-spacing="3">PRECIO ACTUAL</text>
  <text x="${pad}" y="860" font-size="160" font-weight="700" fill="#ffffff">${escapeXml(price)}</text>
  ${
    changePct !== null
      ? `<rect x="${pad}" y="900" width="${changeLabel.length * 28 + 80}" height="90" rx="45" fill="#16171b"/>
         <text x="${pad + 40}" y="962" font-size="46" font-weight="600" fill="${changeColor}">${changeLabel}</text>`
      : ""
  }

  <!-- Banner de estructura -->
  <rect x="${pad}" y="1040" width="${W - pad * 2}" height="110" rx="24" fill="none" stroke="${bannerColor}" stroke-width="5"/>
  <text x="${W / 2}" y="1112" font-size="42" font-weight="700" fill="${bannerColor}" text-anchor="middle">${escapeXml(bannerText)}</text>

  <!-- Grafico de velas -->
  ${chartContent}
  <line x1="${pad}" y1="3150" x2="${W - pad}" y2="3150" stroke="#1c1d21" stroke-width="4"/>

  <!-- RSI + Tendencia, en una sola fila para dejarle todo el espacio al grafico -->
  <rect x="${pad}" y="3190" width="${(W - pad * 2 - 40) / 2}" height="280" rx="40" fill="${rsiInfo ? rsiInfo.bg : "#16171b"}"/>
  <text x="${pad + 56}" y="3280" font-size="42" font-weight="600" fill="${rsiInfo ? rsiInfo.fg : "#8a8d93"}" opacity="0.85">RSI (14)</text>
  <text x="${pad + 56}" y="3380" font-size="72" font-weight="700" fill="${rsiInfo ? rsiInfo.fg : "#ffffff"}">${rsiValue} ${rsiInfo ? "&#183; " + rsiInfo.label : ""}</text>

  <rect x="${pad + (W - pad * 2 - 40) / 2 + 40}" y="3190" width="${(W - pad * 2 - 40) / 2}" height="280" rx="40" fill="#16171b"/>
  <text x="${pad + (W - pad * 2 - 40) / 2 + 40 + 56}" y="3280" font-size="42" font-weight="600" fill="#8a8d93">Tendencia</text>
  <text x="${pad + (W - pad * 2 - 40) / 2 + 40 + 56}" y="3380" font-size="72" font-weight="700" fill="${trendInfo ? trendInfo.fg : "#ffffff"}">${trendInfo ? (data.trend === "alcista" ? "&#9650;" : "&#9660;") : ""} ${trendInfo ? trendInfo.label : "N/D"}</text>

  <!-- Footer -->
  <text x="${pad}" y="3560" font-size="60" font-weight="700" fill="#ffffff">+45 criptomonedas &#183; graficos en vivo &#183; gratis</text>
  <text x="${pad}" y="3630" font-size="52" font-weight="600" fill="${c1}">invest-platform-chi.vercel.app</text>
  <text x="${pad}" y="3700" font-size="38" font-weight="400" fill="#5b5e66">No es asesoria financiera. Informate y decide con responsabilidad.</text>
</svg>`;
  });
}

// Genera las imagenes (PNG) de TODAS las etapas de la revelacion
// progresiva del Reel: "empty" (cuadricula), "candles" (velas solas),
// "bos", "zones", "liquidity" y "full" (con la flecha de entrada). El
// script que arma el video (post-reel-to-facebook.mjs) usa "hasStructure"
// para saber si hay una estructura SMC real que ir revelando por partes,
// o si debe tratar el video como antes (solo dos etapas: vacio y
// completo), cuando no se detecto una ruptura clara.
export async function renderReelStages(coin, data) {
  const stageNames = ["empty", "candles", "bos", "zones", "liquidity", "full"];
  const svgs = await Promise.all(stageNames.map((stage) => buildCardSvg(coin, data, { stage })));
  const pngs = await Promise.all(svgs.map((svg) => sharp(Buffer.from(svg)).png().toBuffer()));

  const history = Array.isArray(data.history) ? data.history.slice(-30) : [];
  const insights = computeChartInsights(history);
  const structure = insights.candles ? computeSmcStructure(insights.candles) : null;

  const images = {};
  stageNames.forEach((name, i) => {
    images[name] = pngs[i];
  });

  return { hasStructure: !!structure, structure, insights, images };
}

// Se mantiene por compatibilidad con codigo que solo necesite las dos
// capas de siempre (vacia y completa).
export async function renderReelLayers(coin, data) {
  const { images } = await renderReelStages(coin, data);
  return { empty: images.empty, full: images.full };
}

// Se mantiene por compatibilidad: la tarjeta completa (con velas) sola.
export async function renderReelBackground(coin, data) {
  const { full } = await renderReelLayers(coin, data);
  return full;
}

// Se exporta tambien para que el script que arma la descripcion y la
// narracion del Reel pueda mencionar el mismo soporte/resistencia, la
// misma zona VI y la misma estructura SMC que se dibujan en el video (un
// solo calculo, sin duplicar logica).
export { computeChartInsights, computeSmcStructure, formatUSD };
