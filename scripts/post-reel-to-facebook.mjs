import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderReelLayers, computeChartInsights } from "./render-reel-background.mjs";

const execFileAsync = promisify(execFile);

const PAGE_ID = process.env.FB_PAGE_ID || "1361643533693650";
const ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const SITE_URL = "https://invest-platform-chi.vercel.app";
const GRAPH_VERSION = "v21.0";

// Motor de voz (Piper TTS, offline y sin costo): el binario y el modelo de
// voz en español se descargan en el workflow de GitHub Actions y quedan
// disponibles en estas rutas (configurables via variables de entorno para
// poder probar en otra maquina).
const PIPER_BIN = process.env.PIPER_BIN || "piper";
const PIPER_MODEL = process.env.PIPER_MODEL || "piper-voices/es_MX-claude-high.onnx";

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

// Texto que se manda al sintetizador de voz: usa el mismo calculo de
// soporte/resistencia/VI que la descripcion (computeChartInsights), para
// que lo que se dice en el audio nunca se desincronice de lo que se ve en
// el grafico ni de lo que dice el texto del post.
function buildNarrationText(coin, data) {
  const history = Array.isArray(data.history) ? data.history.slice(-30) : [];
  const insights = computeChartInsights(history);

  const frases = [`Analisis de ${coin.name}. Precio actual: ${formatSpokenUSD(data.currentPrice)}.`];

  if (data.rsi != null && data.rsiSignal) {
    frases.push(`El RSI esta en ${Math.round(data.rsi)}, en zona ${data.rsiSignal}.`);
  }
  if (data.trend) {
    frases.push(`La tendencia es ${data.trend}.`);
  }
  if (insights.support !== null && insights.resistance !== null) {
    frases.push(
      `Soporte cercano en ${formatSpokenUSD(insights.support)}, y resistencia en ${formatSpokenUSD(
        insights.resistance
      )}.`
    );
  }
  if (insights.vi) {
    frases.push(`Se detecto una zona de volumen desequilibrado, con sesgo ${insights.vi.bias}.`);
  }
  frases.push("Mas analisis tecnico gratis en InvestPanel.");

  return frases.join(" ");
}

// Genera el audio de la narracion con Piper TTS (voz neuronal offline, sin
// costo y sin depender de un servicio externo en vivo). Se le manda el
// texto por stdin, tal como espera el binario de piper.
function synthesizeNarration(text, outWavPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PIPER_BIN, [
      "--model", PIPER_MODEL,
      "--output_file", outWavPath,
      "--length_scale", "1.05",
      "--sentence_silence", "0.35",
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

// Convierte las dos capas de fondo (sin velas / con velas) en un video
// vertical: primero revela el grafico de velas de izquierda a derecha
// (como si se fuera dibujando y las velas fueran subiendo y bajando),
// despues aplica un zoom que "respira" (entra y sale suavemente) durante
// todo el video mas un flash de luz al inicio para llamar la atencion, y
// por ultimo mezcla el audio: la narracion de voz (Piper TTS, generada
// aparte) como pista principal, mas un colchon ambiental de fondo muy
// suave y una campanita institucional breve antes de que empiece a
// hablar la voz — cumpliendo los requisitos tecnicos de Reels (mp4,
// h264, aac, 9:16). La duracion total se ajusta a lo que dura la
// narracion (con un minimo y un maximo razonables) para que la voz nunca
// quede cortada ni el video se sienta vacio si el texto es corto.
async function buildReelVideo(layers, narrationPath, outPath) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "reel-"));
  const emptyPath = path.join(tmpDir, "bg-empty.png");
  const fullPath = path.join(tmpDir, "bg-full.png");
  await Promise.all([writeFile(emptyPath, layers.empty), writeFile(fullPath, layers.full)]);

  const fps = 30;
  const sr = 48000;
  const introSec = 0.8;
  const outroPadSec = 1.5;

  const narrationSec = await getAudioDurationSec(narrationPath);
  const durationSec = Math.min(32, Math.max(18, Math.round(introSec + narrationSec + outroPadSec)));
  const totalFrames = durationSec * fps;
  const introMs = Math.round(introSec * 1000);
  const revealSec = Math.min(9, durationSec - 4);
  const zoomExpr = "1.05+0.12*(0.5+0.5*sin(2*PI*on/150))";

  // Nota: el zoom ("zoompan") hay que aplicarlo ANTES de mezclar las dos
  // capas, no despues sobre el video ya compuesto — zoompan esta pensado
  // para una sola imagen fija en loop, y si se le da un video que ya
  // cambia con el tiempo (la revelacion de las velas) se queda pegado en
  // el primer frame. Por eso: primero se le aplica el mismo zoom a cada
  // capa por separado (quedan sincronizadas porque el zoom depende solo
  // del numero de frame, no del contenido), y despues se revela la capa
  // "completa" (con velas) de izquierda a derecha sobre la capa "vacia"
  // (cuadricula) ya con el zoom aplicado, simulando que el grafico se
  // dibuja y las velas van subiendo y bajando.
  const videoFilter =
    `[0:v]zoompan=z='${zoomExpr}':d=${totalFrames}:s=1080x1920:fps=${fps}[z0];` +
    `[1:v]zoompan=z='${zoomExpr}':d=${totalFrames}:s=1080x1920:fps=${fps}[z1];` +
    `[z0]trim=duration=${revealSec},setpts=PTS-STARTPTS[z0t];` +
    `[z1]trim=duration=${durationSec},setpts=PTS-STARTPTS[z1t];` +
    `[z0t][z1t]xfade=transition=wiperight:duration=${revealSec}:offset=0[composited];` +
    `[composited]eq=eval=frame:brightness='if(lt(t,0.3),0.30*(1-t/0.3),0)',format=yuv420p[v]`;

  // Nota: usamos "aevalsrc" (no el filtro "sine") para generar los tonos,
  // porque "sine" en este ffmpeg sale a un volumen interno muy bajo por
  // defecto (sin forma de subirlo), lo que hacia que todo el audio
  // quedara casi inaudible sin importar los multiplicadores de volumen.
  // Con "aevalsrc" controlamos la amplitud real de cada tono.
  const tone = (freq, dur) => `aevalsrc=exprs='sin(2*PI*${freq}*t)':s=${sr}:d=${dur}`;

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
    // Colchon ambiental de fondo, bien discreto para no competir con la voz
    `[2:a]afade=t=in:st=0:d=1,afade=t=out:st=${durationSec - 1.5}:d=1.5,volume=0.035[pad1]`,
    `[3:a]afade=t=in:st=0:d=1,afade=t=out:st=${durationSec - 1.5}:d=1.5,volume=0.028[pad2]`,
    // Campanita institucional breve, justo antes de que arranque la narracion
    `[4:a]afade=t=out:st=0.55:d=0.15,volume=0.8[bell]`,
    // Narracion de voz (Piper TTS): se reescala a la frecuencia del
    // proyecto y se retrasa lo mismo que tarda la campanita en sonar
    `[5:a]aresample=${sr},adelay=${introMs}:all=1,volume=1.6[voice]`,
    `[pad1][pad2][bell][voice]amix=inputs=4:duration=longest:normalize=0[amixed]`,
    // Solo un limitador suave como red de seguridad (sin compresor ni
    // normalizador agresivo, que fue lo que distorsionaba el sonido)
    `[amixed]afade=t=in:st=0:d=0.2,afade=t=out:st=${(durationSec - 0.8).toFixed(1)}:d=0.8,alimiter=limit=0.95,pan=stereo|c0=c0|c1=c0[a]`,
  ].join(";");

  const args = [
    "-y",
    "-loop", "1",
    "-i", emptyPath,
    "-loop", "1",
    "-i", fullPath,
    "-f", "lavfi", "-i", tone(130.81, durationSec),
    "-f", "lavfi", "-i", tone(196.00, durationSec),
    "-f", "lavfi", "-i", bell(659.25, 2.5),
    "-i", narrationPath,
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
    outPath,
  ];

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

async function waitUntilProcessed(videoId, { tries = 20, delayMs = 6000 } = {}) {
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

  const layers = await renderReelLayers(coin, data);
  console.log(`Fondo generado (vacio: ${layers.empty.length} bytes, completo: ${layers.full.length} bytes)`);

  const narrationText = buildNarrationText(coin, data);
  console.log("Narracion:\n" + narrationText);
  const narrationPath = path.join(tmpdir(), `narracion-${coin.id}-${Date.now()}.wav`);
  await synthesizeNarration(narrationText, narrationPath);

  const outPath = path.join(tmpdir(), `reel-${coin.id}-${Date.now()}.mp4`);
  await buildReelVideo(layers, narrationPath, outPath);
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
