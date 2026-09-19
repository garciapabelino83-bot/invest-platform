// Fórmulas de los indicadores técnicos (los mismos que usan BingX, Binance,
// TradingView, etc.). Son funciones puras: reciben las velas y devuelven los
// puntos ya calculados, listos para dibujar en el gráfico.

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type Punto = { time: number; value: number };

export function sma(candles: Candle[], period: number): Punto[] {
  const result: Punto[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    result.push({ time: candles[i].time, value: sum / period });
  }
  return result;
}

function emaDeValores(valores: Punto[], period: number): Punto[] {
  const result: Punto[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < valores.length; i++) {
    if (prev === null) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += valores[j].value;
      prev = sum / period;
    } else {
      prev = valores[i].value * k + prev * (1 - k);
    }
    result.push({ time: valores[i].time, value: prev });
  }
  return result;
}

export function ema(candles: Candle[], period: number): Punto[] {
  return emaDeValores(
    candles.map((c) => ({ time: c.time, value: c.close })),
    period
  );
}

export function bollinger(candles: Candle[], period = 20, mult = 2) {
  const mid: Punto[] = [];
  const upper: Punto[] = [];
  const lower: Punto[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1).map((c) => c.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    mid.push({ time: candles[i].time, value: mean });
    upper.push({ time: candles[i].time, value: mean + mult * sd });
    lower.push({ time: candles[i].time, value: mean - mult * sd });
  }

  return { mid, upper, lower };
}

export function rsi(candles: Candle[], period = 14): Punto[] {
  const result: Punto[] = [];
  if (candles.length < period + 1) return result;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  const calcRsi = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  result.push({ time: candles[period].time, value: calcRsi(avgGain, avgLoss) });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push({ time: candles[i].time, value: calcRsi(avgGain, avgLoss) });
  }

  return result;
}

export function macd(candles: Candle[], fast = 12, slow = 26, signalPeriod = 9) {
  const closes = candles.map((c) => ({ time: c.time, value: c.close }));
  const emaFast = emaDeValores(closes, fast);
  const emaSlow = emaDeValores(closes, slow);
  const slowByTime = new Map(emaSlow.map((p) => [p.time, p.value]));

  const macdLine: Punto[] = [];
  for (const p of emaFast) {
    const slowVal = slowByTime.get(p.time);
    if (slowVal !== undefined) macdLine.push({ time: p.time, value: p.value - slowVal });
  }

  const signalLine = emaDeValores(macdLine, signalPeriod);
  const signalByTime = new Map(signalLine.map((p) => [p.time, p.value]));

  const histogram: Punto[] = [];
  for (const p of macdLine) {
    const sig = signalByTime.get(p.time);
    if (sig !== undefined) histogram.push({ time: p.time, value: p.value - sig });
  }

  return { macdLine, signalLine, histogram };
}

export function kdj(candles: Candle[], period = 9, kSmooth = 3, dSmooth = 3) {
  const kLine: Punto[] = [];
  const dLine: Punto[] = [];
  const jLine: Punto[] = [];
  let prevK = 50;
  let prevD = 50;

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const highMax = Math.max(...slice.map((c) => c.high));
    const lowMin = Math.min(...slice.map((c) => c.low));
    const rsv = highMax === lowMin ? 50 : ((candles[i].close - lowMin) / (highMax - lowMin)) * 100;
    const k = (prevK * (kSmooth - 1) + rsv) / kSmooth;
    const d = (prevD * (dSmooth - 1) + k) / dSmooth;
    const j = 3 * k - 2 * d;
    prevK = k;
    prevD = d;
    kLine.push({ time: candles[i].time, value: k });
    dLine.push({ time: candles[i].time, value: d });
    jLine.push({ time: candles[i].time, value: j });
  }

  return { kLine, dLine, jLine };
}

export function williamsR(candles: Candle[], period = 14): Punto[] {
  const result: Punto[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const highMax = Math.max(...slice.map((c) => c.high));
    const lowMin = Math.min(...slice.map((c) => c.low));
    const wr = highMax === lowMin ? 0 : ((highMax - candles[i].close) / (highMax - lowMin)) * -100;
    result.push({ time: candles[i].time, value: wr });
  }
  return result;
}
