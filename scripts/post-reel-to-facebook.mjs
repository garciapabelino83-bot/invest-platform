import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderReelBackground } from "./render-reel-background.mjs";

const execFileAsync = promisify(execFile);

const PAGE_ID = process.env.FB_PAGE_ID || "1361643533693650";
const ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const SITE_URL = "https://invest-platform-chi.vercel.app";
const GRAPH_VERSION = "v21.0";

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

function buildCaption(coin, data) {
  const price = formatUSD(data.currentPrice);
  const rsiTxt = data.rsiSignal ? `RSI ${data.rsi} (${data.rsiSignal})` : "";
  const trendTxt = data.trend ? `Tendencia ${data.trend}` : "";

  return [
    `${coin.name} (${coin.symbol}) hoy: ${price}`,
    [rsiTxt, trendTxt].filter(Boolean).join(" | "),
    "",
    "Analisis tecnico gratis de +45 criptomonedas en InvestPanel:",
    SITE_URL,
    "",
    "#Bitcoin #Cripto #Trading #InvestPanel #Reels",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

// Convierte la imagen de fondo (2160x3840) en un video vertical de ~15s
// con un zoom lento (efecto Ken Burns) y una pista de audio en silencio,
// cumpliendo los requisitos tecnicos de Reels (mp4, h264, aac, 9:16).
async function buildReelVideo(pngBuffer, outPath) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "reel-"));
  const imgPath = path.join(tmpDir, "bg.png");
  await writeFile(imgPath, pngBuffer);

  const durationSec = 15;
  const fps = 30;
  const totalFrames = durationSec * fps;

  const args = [
    "-y",
    "-loop", "1",
    "-i", imgPath,
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-filter_complex",
    `[0:v]zoompan=z='min(zoom+0.0012,1.18)':d=${totalFrames}:s=1080x1920:fps=${fps},format=yuv420p[v]`,
    "-map", "[v]",
    "-map", "1:a",
    "-t", String(durationSec),
    "-c:v", "libx264",
    "-profile:v", "high",
    "-g", String(fps * 2),
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    "-shortest",
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

  const bgBuffer = await renderReelBackground(coin, data);
  console.log(`Fondo generado (${bgBuffer.length} bytes)`);

  const outPath = path.join(tmpdir(), `reel-${coin.id}-${Date.now()}.mp4`);
  await buildReelVideo(bgBuffer, outPath);
  const videoBuffer = await readFile(outPath);
  console.log(`Video generado (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

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
