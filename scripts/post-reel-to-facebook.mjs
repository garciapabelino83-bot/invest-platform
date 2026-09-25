import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderReelStages, computeChartInsights } from "./render-reel-background.mjs";
import { renderCharacterFrames } from "./reel-character.mjs";

const execFileAsync = promisify(execFile);

const PAGE_ID = process.env.FB_PAGE_ID || "1361643533693650";
const ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const SITE_URL = "https://invest-platform-chi.vercel.app";
const GRAPH_VERSION = "v21.0";

// Motor de voz (Piper TTS, offline y sin costo): el binario y el modelo de
// voz en español se descargan en el workflow de GitHub Actions y quedan
// disponibles en estas rutas (configurables via variables de entorno para
// poder probar en otra maquina). Se cambio a una voz masculina
// (es_ES-davefx-medium) porque la anterior (es_MX-claude-high) no era la
// que se queria para el Reel.
const PIPER_BIN = process.env.PIPER_BIN || "piper";
const PIPER_MODEL = process.env.PIPER_MODEL || "piper-voices/es_ES-davefx-medium.onnx";

if (!ACCESS_TOKEN) {
  console.error("Falta la variable FB_PAGE_ACCESS_TOKEN");
  process.exit(1);
}

// Usamos una moneda distinta a la de los posts de imagen (que ya rotan
// dos veces al dia), para que el Reel no coincida siempre con la misma.
const COINS = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "ripple", name: "XRP", symbol: "XRP" },
  { id: "cardano", name: "Cardano", symbol: "ADA" },
  { id: "binancecoin", name: "BNB", symbol: "BNB" },
];

function pickCoinOfTheDay() {
  // Permite forzar una moneda especifica (por ejemplo, para probar un
  // cambio de diseno con Bitcoin) sin alterar la rotacion diaria normal.
  const forced = (process.env.FORCE_COIN || "").trim().toLowerCase();
  if (forced) {
    const match = COINS.find((c) => c.id.toLowerCase() === forced);
    if (match) return match;
    console.warn(`FORCE_COIN="${forced}" no coincide con ninguna moneda conocida, se ignora.`);
  }

  const start = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 0));
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000);
  return COINS[dayOfYear % COINS.length];
}

function formatUSD(n) {
  if (n === null || n === undefined) return "N/D";
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

async function fetchAnalysis(coinId) {
  const res = await fetch(`${SITE_URL}/api/analysis?coin=${coinId}`);
  if (!res.ok) throw new Error(`No se pudo obtener el analisis (status ${res.status})`);
  return res.json();
}

// Los mismos soporte/resistencia y la misma zona de Volume Imbalance que
// se dibujan en el video se mencionan aqui en la descripcion, usando el
// mismo calculo (computeChartInsights) para que el texto y el video
// nunca queden desincronizados.
function buildCaption(coin, data) {
  const price = formatUSD(data.currentPrice);
  const rsiTxt = data.rsiSignal ? `RSI ${data.rsi} (${data.rsiSignal})` : "";
  const trendTxt = data.trend ? `Tendencia ${data.trend}` : "";

  const history = Array.isArray(data.history) ? data.history.slice(-30) : [];
  const insights = computeChartInsights(history);
  const levelsTxt =
    insights.support !== null && insights.resistance !== null
      ? `Soporte ${formatUSD(insights.support)} | Resistencia ${formatUSD(insights.resistance)}`
      : "";
  const viTxt = insights.vi ? `Zona de Volume Imbalance (VI) con sesgo ${insights.vi.bias}` : "";

  return [
    `${coin.name} (${coin.symbol}) hoy: ${price}`,
    [rsiTxt, trendTxt].filter(Boolean).join(" | "),
    levelsTxt,
    viTxt,
    "",
    "Analisis tecnico gratis de +45 criptomonedas en InvestPanel:",
    SITE_URL,
    "",
    "#Bitcoin #Cripto #Trading #InvestPanel #Reels",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

// Lee un monto en dolares de forma natural hablada ("114 dolares con 41
// centavos"), en vez de dejar que el sintetizador de voz intente adivinar
// como leer el simbolo "$" y el punto decimal.
function formatSpokenUSD(n) {
  if (n === null || n === undefined) return "";
  if (n < 1) return `${n.toFixed(4)} dolares`;
  const dollars = Math.floor(n);
  const cents = Math.round((n - dollars) * 100);
  return cents > 0 ? `${dollars} dolares con ${cents} centavos` : `${dollars} dolares`;
}

// Construye la narracion como una lista de PASOS (no un solo bloque de
// texto), para poder explicar el grafico igual que lo haria una persona:
// primero el precio, despues cada pieza de la estructura SMC en el mismo
// orden en que se va a ir revelando en el video (etiqueta "stage" en cada
// paso). El script que arma el video (buildReelVideo) usa esas mismas
// etiquetas para saber, de forma aproximada, en que momento del audio
// debe aparecer cada elemento nuevo en pantalla.
function buildNarrationSegments(coin, data, structure, insights) {
  const steps = [];

  steps.push({
    stage: "candles",
    text: `Analisis de ${coin.name}. Precio actual: ${formatSpokenUSD(data.currentPrice)}.`,
  });
  if (data.rsi != null && data.rsiSignal) {
    steps.push({ stage: "candles", text: `El RSI esta en ${Math.round(data.rsi)}, en zona ${data.rsiSignal}.` });
  }
  if (data.trend) {
    steps.push({ stage: "candles", text: `La tendencia general es ${data.trend}.` });
  }

  if (structure) {
    const biasWord = structure.bias === "alcista" ? "alcista" : "bajista";
    steps.push({
      stage: "bos",
      text: `Miremos la estructura del mercado. El precio rompio un nivel anterior, esto se conoce como B, O, S, con sesgo ${biasWord}, cerca de ${formatSpokenUSD(
        structure.bos.price
      )}.`,
    });

    const zoneWord = structure.bias === "alcista" ? "zona de demanda" : "zona de oferta";
    steps.push({
      stage: "zones",
      text: `Justo antes de ese movimiento se formo un Order Block, la ${zoneWord}, entre ${formatSpokenUSD(
        structure.orderBlock.bottom
      )} y ${formatSpokenUSD(structure.orderBlock.top)}.`,
    });

    steps.push({
      stage: "liquidity",
      text: `Mas alla de esa zona hay liquidez acumulada cerca de ${formatSpokenUSD(
        structure.liquidity.price
      )}, un nivel que el precio todavia no ha tocado.`,
    });

    const rrText =
      structure.entry.rr !== null
        ? `, con una relacion riesgo beneficio de ${structure.entry.rr.toFixed(1)} a uno`
        : "";
    steps.push({
      stage: "full",
      text: `La entrada estaria cerca de ${formatSpokenUSD(
        structure.entry.entryPrice
      )}, buscando un objetivo en ${formatSpokenUSD(structure.entry.targetPrice)}${rrText}.`,
    });
  } else {
    if (insights.support !== null && insights.resistance !== null) {
      steps.push({
        stage: "full",
        text: `Soporte cercano en ${formatSpokenUSD(insights.support)}, y resistencia en ${formatSpokenUSD(
          insights.resistance
        )}.`,
      });
    }
    if (insights.vi) {
      steps.push({
        stage: "full",
        text: `Tambien se detecto una zona de volumen desequilibrado, con sesgo ${insights.vi.bias}.`,
      });
    }
  }

  steps.push({ stage: "full", text: "Recuerda: esto no es asesoria financiera. Mas analisis tecnico gratis en InvestPanel." });

  return steps;
}

// Genera el audio de la narracion con Piper TTS (voz neuronal offline, sin
// costo y sin depender de un servicio externo en vivo). Se le manda el
// texto por stdin, tal como espera el binario de piper.
function synthesizeNarration(text, outWavPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PIPER_BIN, [
      "--model", PIPER_MODEL,
      "--output_file", outWavPath,
      // Se bajo un poco la velocidad (length_scale mas alto = mas lento) y
      // se alargo la pausa entre frases para que la narracion se sienta
      // como una explicacion paso a paso. Se moderó de 1.3 a 1.15: un
      // valor tan alto como 1.3 hacia que la voz sonara mas cortada y
      // artificial (cada palabra separada de la siguiente), un efecto que
      // se reporto como "robotico". 1.15 sigue siendo notablemente mas
      // lento que la voz por defecto (1.0) pero conserva un flujo natural.
      "--length_scale", "1.15",
      "--sentence_silence", "0.45",
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Piper (voz) termino con codigo ${code}: ${stderr}`));
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

async function getAudioDurationSec(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const seconds = parseFloat(stdout.trim());
  return Number.isFinite(seconds) ? seconds : 0;
}

// Calcula, de forma aproximada, en que segundo del video deberia
// aparecer cada etapa nueva (bos, zones, liquidity, full), basandose en
// cuantas palabras de la narracion ya se dijeron antes de esa etapa
// (Piper habla a un ritmo bastante parejo, asi que repartir el tiempo
// segun la cantidad de palabras es una buena aproximacion sin tener que
// sintetizar cada frase por separado). "candles" siempre empieza en el
// segundo 0 (el grafico se revela de una vez, antes incluso de que
// termine de sonar la campanita).
function computeStageStartTimes(segments, introSec, narrationSec) {
  const wordCounts = segments.map((s) => s.text.trim().split(/\s+/).filter(Boolean).length || 1);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0) || 1;

  const starts = { candles: 0 };
  let cumWords = 0;
  segments.forEach((seg, i) => {
    const startFrac = cumWords / totalWords;
    if (!(seg.stage in starts)) {
      starts[seg.stage] = seg.stage === "candles" ? 0 : introSec + startFrac * narrationSec;
    }
    cumWords += wordCounts[i];
  });

  return starts;
}

// Arma el video vertical revelando cada etapa de la estructura SMC UNA
// POR UNA, mas o menos al mismo tiempo en que la narracion la va
// explicando: el grafico se dibuja una sola vez al inicio (velas solas),
// se queda QUIETO mientras se habla de el, y solo se mueve con un
// pequeno "salto" de zoom cada vez que aparece un elemento nuevo (BOS,
// Order Block, Liquidez, flecha de entrada) — ya no hay un zoom
// continuo "respirando" durante todo el video. Al final se mezcla el
// audio: la narracion de voz (Piper TTS) como pista principal, mas una
// campanita institucional breve antes de que empiece a hablar —
// cumpliendo los requisitos tecnicos de Reels (mp4, h264, aac, 9:16). La
// duracion total se ajusta a lo que dura la narracion (con un minimo y
// un maximo razonables) para que la voz nunca quede cortada.
async function buildReelVideo(stages, segments, narrationPath, outPath) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "reel-"));

  const fps = 30;
  const sr = 48000;
  const introSec = 0.8;
  const outroPadSec = 1.5;
  const pulseSec = 0.6;
  // Se subio el "salto" de zoom (antes 0.05, casi imperceptible) y se le
  // agrego un destello breve de brillo sincronizado, para que se note con
  // claridad el momento en que aparece cada elemento nuevo — el usuario
  // reporto que la revelacion paso a paso "no se notaba bien".
  const pulseAmount = 0.09;
  const flashAmount = 0.22;

  const narrationSec = await getAudioDurationSec(narrationPath);
  const durationSec = Math.min(32, Math.max(18, Math.round(introSec + narrationSec + outroPadSec)));
  const introMs = Math.round(introSec * 1000);

  const stageOrder = ["candles", "bos", "zones", "liquidity", "full"];
  const starts = computeStageStartTimes(segments, introSec, narrationSec);
  const presentStages = stageOrder.filter((name) => name in starts && name in stages.images);

  // Duracion de cada etapa: desde su inicio hasta el inicio de la
  // siguiente, y la ultima hasta el final del video. Se fuerza un minimo
  // de 0.4s por etapa para que ffmpeg nunca reciba un clip de largo cero.
  const stagesTimeline = presentStages.map((name, i) => {
    const start = starts[name];
    const nextStart = i + 1 < presentStages.length ? starts[presentStages[i + 1]] : durationSec;
    const duration = Math.max(0.4, nextStart - start);
    return { name, duration };
  });

  const candlesDuration = stagesTimeline[0].duration;
  const introRevealSec = Math.max(Math.min(0.3, candlesDuration), Math.min(1.0, candlesDuration * 0.6));
  const candlesHoldDur = Math.max(0, candlesDuration - introRevealSec);

  // Escribe a disco solo las imagenes que realmente se van a usar:
  // "empty" (para la revelacion inicial) mas cada etapa presente.
  const videoInputs = ["empty", ...presentStages];
  const imagePaths = {};
  await Promise.all(
    videoInputs.map(async (name) => {
      const p = path.join(tmpDir, `stage-${name}.png`);
      await writeFile(p, stages.images[name]);
      imagePaths[name] = p;
    })
  );
  const inputIndex = (name) => videoInputs.indexOf(name);

  // --- Personaje animado (mascota "Toro") ---
  // Aparece en una esquina del video como si fuera el presentador: gesto
  // de "idle" (saludando) mientras se dice el precio/RSI/tendencia, gesto
  // de "explicando" (mano senalando el grafico) durante la estructura
  // SMC, y "pulgar arriba" en el cierre (entrada/RR). La boca se anima
  // alternando dos dibujos (abierta/cerrada) a un ritmo fijo, como un
  // dibujo animado clasico, para dar sensacion de que esta hablando sin
  // necesitar sincronizacion labial real.
  const charFrames = await renderCharacterFrames();
  const charKeys = ["idle_open", "idle_closed", "explain_open", "explain_closed", "thumbsup"];
  const charPaths = {};
  await Promise.all(
    charKeys.map(async (key) => {
      const p = path.join(tmpDir, `char-${key}.png`);
      await writeFile(p, charFrames[key]);
      charPaths[key] = p;
    })
  );
  const charInputIndex = (key) => videoInputs.length + charKeys.indexOf(key);

  const CHAR_SIZE = 260;
  const CHAR_X = 40;
  const CHAR_Y = 1270;
  const flapFrames = 5; // cuadros por gesto de boca (~0.17s a 30fps): ritmo de "hablando"
  const flapHoldSec = flapFrames / fps;

  const poseForStage = (name) => {
    if (name === "candles") return "idle";
    if (name === "full") return "thumbsup";
    return "explain";
  };

  const segFilters = [];
  const segLabels = [];

  // Revelacion inicial: de la cuadricula vacia a las velas, de izquierda
  // a derecha, muy al principio del video.
  segFilters.push(
    `[${inputIndex("empty")}:v]fps=${fps},scale=1080:1920,trim=duration=${introRevealSec.toFixed(
      3
    )},setpts=PTS-STARTPTS[introA]`
  );
  segFilters.push(
    `[${inputIndex("candles")}:v]fps=${fps},scale=1080:1920,trim=duration=${introRevealSec.toFixed(
      3
    )},setpts=PTS-STARTPTS[introB]`
  );
  segFilters.push(
    `[introA][introB]xfade=transition=wiperight:duration=${introRevealSec.toFixed(3)}:offset=0[segIntro]`
  );
  segLabels.push("segIntro");

  // El resto del tiempo de "candles" (si queda) se ve quieto, sin zoom,
  // mientras la voz habla del precio, el RSI y la tendencia.
  if (candlesHoldDur > 0.05) {
    segFilters.push(
      `[${inputIndex("candles")}:v]fps=${fps},scale=1080:1920,trim=duration=${candlesHoldDur.toFixed(
        3
      )},setpts=PTS-STARTPTS[segCandlesHold]`
    );
    segLabels.push("segCandlesHold");
  }

  // Cada etapa siguiente (bos, zones, liquidity, full) se queda quieta
  // durante todo su tiempo, salvo un pequeno "salto" de zoom justo al
  // aparecer, para que se note que algo nuevo se dibujo sin que el
  // grafico este todo el tiempo moviendose.
  for (let i = 1; i < stagesTimeline.length; i++) {
    const stage = stagesTimeline[i];
    const totalFrames = Math.max(1, Math.round(stage.duration * fps));
    const pulseFrames = Math.max(1, Math.min(Math.round(pulseSec * fps), totalFrames));
    const zExpr = `if(lte(on,${pulseFrames}),1.0+${pulseAmount}*sin(PI*on/${pulseFrames}),1.0)`;
    const flashExpr = `if(lte(t,${pulseSec.toFixed(2)}),${flashAmount.toFixed(2)}*sin(PI*t/${pulseSec.toFixed(2)}),0)`;
    const label = `seg_${stage.name}`;
    segFilters.push(
      `[${inputIndex(stage.name)}:v]zoompan=z='${zExpr}':d=${totalFrames}:s=1080x1920:fps=${fps},` +
        `eq=eval=frame:brightness='${flashExpr}',` +
        `trim=duration=${stage.duration.toFixed(3)}[${label}]`
    );
    segLabels.push(label);
  }

  const concatInputs = segLabels.map((l) => `[${l}]`).join("");
  segFilters.push(`${concatInputs}concat=n=${segLabels.length}:v=1:a=0[vraw]`);
  segFilters.push(`[vraw]eq=eval=frame:brightness='if(lt(t,0.3),0.30*(1-t/0.3),0)'[vbase]`);

  // Pista del personaje: un segmento por etapa (mismo reparto de tiempo
  // que el grafico), cada uno con su gesto y su ciclo de boca abierta/
  // cerrada en loop, recortado a la duracion exacta de esa etapa.
  const charSegFilters = [];
  const charSegLabels = [];
  stagesTimeline.forEach((stage, i) => {
    const pose = poseForStage(stage.name);
    const label = `charseg_${i}`;
    if (pose === "thumbsup") {
      charSegFilters.push(
        `[${charInputIndex("thumbsup")}:v]fps=${fps},scale=${CHAR_SIZE}:${CHAR_SIZE},trim=duration=${stage.duration.toFixed(
          3
        )},setpts=PTS-STARTPTS[${label}]`
      );
    } else {
      const cycleFrames = flapFrames * 2;
      const repeats = Math.ceil(stage.duration / (flapHoldSec * 2)) + 2;
      charSegFilters.push(
        `[${charInputIndex(`${pose}_open`)}:v]fps=${fps},scale=${CHAR_SIZE}:${CHAR_SIZE},trim=duration=${flapHoldSec.toFixed(
          4
        )},setpts=PTS-STARTPTS[co_${i}]`
      );
      charSegFilters.push(
        `[${charInputIndex(`${pose}_closed`)}:v]fps=${fps},scale=${CHAR_SIZE}:${CHAR_SIZE},trim=duration=${flapHoldSec.toFixed(
          4
        )},setpts=PTS-STARTPTS[cc_${i}]`
      );
      charSegFilters.push(`[co_${i}][cc_${i}]concat=n=2:v=1:a=0[ccycle_${i}]`);
      charSegFilters.push(
        `[ccycle_${i}]loop=loop=${repeats}:size=${cycleFrames}:start=0,trim=duration=${stage.duration.toFixed(
          3
        )},setpts=PTS-STARTPTS[${label}]`
      );
    }
    charSegLabels.push(label);
  });
  const charConcatInputs = charSegLabels.map((l) => `[${l}]`).join("");
  charSegFilters.push(`${charConcatInputs}concat=n=${charSegLabels.length}:v=1:a=0[charTrack]`);

  // Se superpone el personaje sobre el grafico ya armado, en una esquina,
  // y recien ahi se pasa a yuv420p (formato final que necesita libx264).
  const overlayFilter = `[vbase][charTrack]overlay=x=${CHAR_X}:y=${CHAR_Y}:format=auto,format=yuv420p[v]`;

  const videoFilter = [...segFilters, ...charSegFilters, overlayFilter].join(";");

  const bellIndex = videoInputs.length + charKeys.length;
  const narrationIndex = bellIndex + 1;

  // Nota: usamos "aevalsrc" (no el filtro "sine") para generar la campana,
  // porque "sine" en este ffmpeg sale a un volumen interno muy bajo por
  // defecto (sin forma de subirlo), lo que hacia que todo el audio
  // quedara casi inaudible sin importar los multiplicadores de volumen.
  // Con "aevalsrc" controlamos la amplitud real del tono.
  //
  // Se quito el "colchon ambiental" de dos tonos sostenidos (sonaba como
  // un zumbido/pitido molesto de fondo durante todo el video, segun
  // reporto un usuario) — ahora el audio es solo la campanita breve al
  // inicio mas la voz, sin ningun tono continuo de fondo.

  // "Campana" con varios armonicos (cada uno con su propia caida
  // exponencial), para que suene a campana institucional/de bolsa de
  // verdad en vez de un pitido sintetico de un solo tono. Solo se usa una
  // vez, justo antes de que entre la voz.
  const bellExpr = (f) =>
    `0.55*exp(-3.2*t)*sin(2*PI*${f}*t)+` +
    `0.30*exp(-5.5*t)*sin(2*PI*${(f * 2.01).toFixed(2)}*t)+` +
    `0.18*exp(-7.5*t)*sin(2*PI*${(f * 3.0).toFixed(2)}*t)+` +
    `0.10*exp(-9.5*t)*sin(2*PI*${(f * 4.2).toFixed(2)}*t)`;
  const bell = (freq, dur) => `aevalsrc=exprs='${bellExpr(freq)}':s=${sr}:d=${dur}`;

  const audioFilters = [
    // Campanita institucional breve, un poco mas baja que antes para que
    // no compita con la voz cuando entra.
    `[${bellIndex}:a]afade=t=out:st=0.55:d=0.15,volume=0.6[bell]`,
    // Narracion de voz (Piper TTS): se reescala a la frecuencia del
    // proyecto y se retrasa lo mismo que tarda la campanita en sonar.
    // Antes se subia el volumen con un simple multiplicador (volume=1.6)
    // y se dejaba que el limitador final recortara los picos — eso era lo
    // que hacia que la voz sonara "mala calidad"/distorsionada. Ahora en
    // vez de eso: se filtra el retumbo grave (highpass), se le da un poco
    // de calidez (leve realce cerca de 220Hz), un poco mas de presencia
    // para que se entienda mejor (realce cerca de 3.2kHz), se recorta el
    // filo mas artificial/metalico tipico de la sintesis de voz (recorte
    // cerca de 6.5kHz), y se normaliza el volumen con "loudnorm" (el
    // mismo tipo de normalizacion que usan las plataformas de streaming)
    // para un nivel parejo y limpio, sin necesidad de subir el volumen a
    // ciegas.
    `[${narrationIndex}:a]aresample=${sr},adelay=${introMs}:all=1,highpass=f=90,equalizer=f=220:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1:g=3,equalizer=f=6500:t=q:w=1:g=-3,loudnorm=I=-15:TP=-1.2:LRA=8[voice]`,
    `[bell][voice]amix=inputs=2:duration=longest:normalize=0[amixed]`,
    // Solo un limitador suave como red de seguridad (sin compresor ni
    // normalizador agresivo adicional, que fue lo que distorsionaba el
    // sonido antes)
    `[amixed]afade=t=in:st=0:d=0.2,afade=t=out:st=${(durationSec - 0.8).toFixed(1)}:d=0.8,alimiter=limit=0.97,pan=stereo|c0=c0|c1=c0[a]`,
  ].join(";");

  const args = ["-y"];
  for (const name of videoInputs) {
    args.push("-loop", "1", "-i", imagePaths[name]);
  }
  for (const key of charKeys) {
    args.push("-loop", "1", "-i", charPaths[key]);
  }
  args.push("-f", "lavfi", "-i", bell(659.25, 2.5));
  args.push("-i", narrationPath);
  args.push(
    "-filter_complex", `${videoFilter};${audioFilters}`,
    "-map", "[v]",
    "-map", "[a]",
    "-t", String(durationSec),
    "-c:v", "libx264",
    "-profile:v", "high",
    "-g", String(fps * 2),
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", String(sr),
    outPath
  );

  await execFileAsync("ffmpeg", args);
  await rm(tmpDir, { recursive: true, force: true });
}

async function graphPost(pathSuffix, params) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pathSuffix}`;
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(params) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Error Graph API (${pathSuffix}): ${JSON.stringify(data)}`);
  return data;
}

async function startReelUpload() {
  return graphPost(`${PAGE_ID}/video_reels`, {
    upload_phase: "start",
    access_token: ACCESS_TOKEN,
  });
}

async function uploadReelBinary(uploadUrl, videoBuffer) {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${ACCESS_TOKEN}`,
      "Content-Type": "application/octet-stream",
      offset: "0",
      file_size: String(videoBuffer.length),
    },
    body: videoBuffer,
  });
  const data = await res.json();
  if (!res.ok || data.success !== true) {
    throw new Error(`Error subiendo el video del Reel: ${JSON.stringify(data)}`);
  }
  return data;
}

async function finishReelUpload(videoId, caption) {
  return graphPost(`${PAGE_ID}/video_reels`, {
    upload_phase: "finish",
    video_id: videoId,
    video_state: "PUBLISHED",
    description: caption,
    access_token: ACCESS_TOKEN,
  });
}

// Se subio el limite de espera (antes 20 intentos x 6s = 2 minutos) porque
// varios Reels se estaban publicando ANTES de que Facebook terminara de
// procesar el video, y quedaban pegados mostrando solo la primera foto fija
// para siempre en vez de reproducirse. Ahora se espera hasta unos 6-7
// minutos, tiempo de sobra dentro del workflow de GitHub Actions.
async function waitUntilProcessed(videoId, { tries = 50, delayMs = 8000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${videoId}?fields=status&access_token=${ACCESS_TOKEN}`
    );
    const data = await res.json();
    const state = data?.status?.video_status;
    console.log(`Estado del video (${i + 1}/${tries}):`, state || JSON.stringify(data));
    if (state === "ready") return true;
    if (state === "error") throw new Error(`Facebook reporto error procesando el video: ${JSON.stringify(data)}`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function main() {
  const coin = pickCoinOfTheDay();
  console.log(`Generando reel de ${coin.name}...`);
  const data = await fetchAnalysis(coin.id);
  const caption = buildCaption(coin, data);
  console.log("Descripcion:\n" + caption);

  const stages = await renderReelStages(coin, data);
  console.log(
    `Etapas generadas (estructura SMC detectada: ${stages.hasStructure ? "si" : "no"}): ` +
      Object.keys(stages.images).join(", ")
  );

  const segments = buildNarrationSegments(coin, data, stages.structure, stages.insights);
  const narrationText = segments.map((s) => s.text).join(" ");
  console.log("Narracion (paso a paso):\n" + segments.map((s) => `[${s.stage}] ${s.text}`).join("\n"));
  const narrationPath = path.join(tmpdir(), `narracion-${coin.id}-${Date.now()}.wav`);
  await synthesizeNarration(narrationText, narrationPath);

  const outPath = path.join(tmpdir(), `reel-${coin.id}-${Date.now()}.mp4`);
  await buildReelVideo(stages, segments, narrationPath, outPath);
  const videoBuffer = await readFile(outPath);
  console.log(`Video generado (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  await rm(narrationPath, { force: true });

  const { video_id, upload_url } = await startReelUpload();
  console.log("Sesion de subida creada. video_id:", video_id);

  await uploadReelBinary(upload_url, videoBuffer);
  console.log("Video subido, esperando a que Facebook lo procese...");

  const ready = await waitUntilProcessed(video_id);
  if (!ready) {
    console.warn("El video sigue procesandose despues de esperar; se intenta publicar de todas formas.");
  }

  const result = await finishReelUpload(video_id, caption);
  console.log("Reel publicado:", JSON.stringify(result));

  await rm(outPath, { force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
