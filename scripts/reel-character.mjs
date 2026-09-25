import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Foto real del robot que genero el usuario con IA (recortada a busto y
// puesta en el mismo marco circular que los personajes dibujados a mano),
// usada cuando style: "photo". Al ser una unica foto (no varios dibujos)
// no se le puede animar la boca cuadro a cuadro; en vez de eso se usa la
// misma imagen para las 5 variantes y se le agrega un pulso de brillo
// suave en el video (ver buildReelVideo en post-reel-to-facebook.mjs) para
// que igual se sienta "vivo" mientras habla.
const PHOTO_PATH = path.join(__dirname, "assets", "robot-photo.png");

// Mascota "Toro" (bull) del Reel: un personaje simple, estilo plano/
// geometrico (no una cara humana realista, para que sea rapido de animar
// y quede bien en cualquier video), en los mismos colores de marca que
// el resto de la tarjeta (naranja InvestPanel). Aparece en una esquina
// del video como si fuera el "presentador" explicando el analisis, con
// una animacion simple de boca abierta/cerrada (como un dibujo animado
// clasico) para dar sensacion de que esta hablando, sin necesidad de
// sincronizacion labial real.
//
// Poses:
//  - "idle": usada mientras se presenta el precio/RSI/tendencia (saluda).
//  - "explain": usada mientras se explica la estructura SMC (BOS, zonas,
//    liquidez) — cejas serias, mano senalando hacia el grafico.
//  - "thumbsup": usada en el cierre (entrada/RR) — ojos felices, pulgar
//    arriba.

const C1 = "#ffb84d";
const C2 = "#ff8a1e";
const DARK = "#0a0b0e";

function svgWrap(inner, size = 500) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C1}"/>
      <stop offset="100%" stop-color="${C2}"/>
    </linearGradient>
    <radialGradient id="shellGrad" cx="38%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#eef1f6"/>
      <stop offset="100%" stop-color="#c9ceda"/>
    </radialGradient>
    <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e8faff"/>
      <stop offset="35%" stop-color="#5ad1ff"/>
      <stop offset="100%" stop-color="#5ad1ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="visorGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#20232b"/>
      <stop offset="100%" stop-color="#05060a"/>
    </linearGradient>
    <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>
  ${inner}
</svg>`;
}

function buildBullSvg({ pose = "idle", mouthOpen = false } = {}) {
  const cx = 250,
    cy = 250;

  const frame =
    `<circle cx="${cx}" cy="${cy}" r="230" fill="${DARK}" fill-opacity="0.62"/>` +
    `<circle cx="${cx}" cy="${cy}" r="230" fill="none" stroke="url(#brandGrad)" stroke-width="10"/>`;

  const body =
    `<path d="M 90 470 Q 250 340 410 470 L 410 500 L 90 500 Z" fill="#1c1e26" stroke="#2a2d38" stroke-width="4"/>` +
    `<path d="M 235 345 L 265 345 L 255 420 L 245 420 Z" fill="url(#brandGrad)"/>`;

  const head = `<circle cx="250" cy="270" r="118" fill="url(#brandGrad)"/>`;

  const earL = `<ellipse cx="128" cy="255" rx="28" ry="36" fill="url(#brandGrad)" stroke="#e8862a" stroke-width="2" transform="rotate(-25 128 255)"/>`;
  const earR = `<ellipse cx="372" cy="255" rx="28" ry="36" fill="url(#brandGrad)" stroke="#e8862a" stroke-width="2" transform="rotate(25 372 255)"/>`;

  const hornL = `<path d="M 165 175 Q 120 130 95 150 Q 130 165 150 205 Z" fill="#eef0f4" stroke="#c7cad1" stroke-width="3"/>`;
  const hornR = `<path d="M 335 175 Q 380 130 405 150 Q 370 165 350 205 Z" fill="#eef0f4" stroke="#c7cad1" stroke-width="3"/>`;

  const snout = `<ellipse cx="250" cy="330" rx="72" ry="48" fill="#fff3e0"/>`;
  const nostrilL = `<ellipse cx="228" cy="332" rx="7" ry="10" fill="#3a2a1a"/>`;
  const nostrilR = `<ellipse cx="272" cy="332" rx="7" ry="10" fill="#3a2a1a"/>`;

  let eyes;
  if (pose === "thumbsup") {
    eyes =
      `<path d="M 195 250 Q 210 235 225 250" fill="none" stroke="#1c1e26" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M 275 250 Q 290 235 305 250" fill="none" stroke="#1c1e26" stroke-width="7" stroke-linecap="round"/>`;
  } else {
    eyes =
      `<ellipse cx="210" cy="250" rx="16" ry="19" fill="#ffffff"/>` +
      `<ellipse cx="290" cy="250" rx="16" ry="19" fill="#ffffff"/>` +
      `<circle cx="213" cy="253" r="8" fill="#1c1e26"/>` +
      `<circle cx="293" cy="253" r="8" fill="#1c1e26"/>`;
  }

  const browsExplain =
    `<path d="M 188 222 L 228 232" stroke="#7a4a12" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M 312 222 L 272 232" stroke="#7a4a12" stroke-width="8" stroke-linecap="round"/>`;
  const browsIdle =
    `<path d="M 190 226 Q 210 218 230 226" fill="none" stroke="#7a4a12" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M 270 226 Q 290 218 310 226" fill="none" stroke="#7a4a12" stroke-width="8" stroke-linecap="round"/>`;
  const brows = pose === "explain" ? browsExplain : browsIdle;

  const mouth = mouthOpen
    ? `<ellipse cx="250" cy="358" rx="22" ry="16" fill="#5a2a1a"/>`
    : `<path d="M 228 358 Q 250 372 272 358" fill="none" stroke="#5a2a1a" stroke-width="6" stroke-linecap="round"/>`;

  let accessory = "";
  if (pose === "idle") {
    accessory =
      `<g transform="translate(378,330) rotate(-10)">` +
      `<ellipse cx="0" cy="0" rx="26" ry="30" fill="#fff3e0"/>` +
      `<rect x="-8" y="-46" width="16" height="30" rx="8" fill="#fff3e0"/>` +
      `<rect x="-24" y="-40" width="14" height="26" rx="7" fill="#fff3e0" transform="rotate(-18 -24 -40)"/>` +
      `<rect x="10" y="-40" width="14" height="26" rx="7" fill="#fff3e0" transform="rotate(18 10 -40)"/>` +
      `</g>`;
  } else if (pose === "explain") {
    accessory =
      `<g transform="translate(70,360)">` +
      `<ellipse cx="0" cy="0" rx="28" ry="24" fill="#fff3e0"/>` +
      `<rect x="-58" y="-11" width="46" height="22" rx="11" fill="#fff3e0"/>` +
      `</g>`;
  } else if (pose === "thumbsup") {
    accessory =
      `<g transform="translate(388,335) rotate(-8)">` +
      `<rect x="-24" y="-8" width="48" height="46" rx="16" fill="#fff3e0"/>` +
      `<rect x="-14" y="-42" width="20" height="40" rx="10" fill="#fff3e0"/>` +
      `</g>`;
  }

  const glowRing =
    pose === "explain"
      ? `<circle cx="${cx}" cy="${cy}" r="230" fill="none" stroke="${C1}" stroke-width="4" stroke-opacity="0.55"/>`
      : "";

  const inner = [
    frame,
    body,
    head,
    earL,
    earR,
    hornL,
    hornR,
    snout,
    nostrilL,
    nostrilR,
    brows,
    eyes,
    mouth,
    accessory,
    glowRing,
  ].join("");

  return svgWrap(inner);
}

// Mascota "Robot analista" — v2. Mismo marco circular y mismo sistema de
// poses/animacion que el toro, pero con un look de robot/IA mucho mas
// "premium" (carcasa blanca brillante con degrade tipo plastico, ojos
// grandes con halo de brillo, visor grande) que el usuario pidio
// explicitamente despues de mandar una imagen de referencia (un robot 3D
// blanco con ojos celestes grandes). No es un render fotorrealista (eso
// necesitaria un generador de imagenes con IA que no tenemos disponible
// aca) pero se acerca lo mas posible dentro de un dibujo vectorial: brillo
// especular en la cabeza, sombra suave debajo, ojos con halo. Es un diseno
// propio (no copia el logo ni la marca de ningun exchange real) combinado
// con los colores de InvestPanel (naranja) para que se sienta parte de la
// misma marca.
function buildRobotSvg({ pose = "idle", mouthOpen = false } = {}) {
  const cx = 250,
    cy = 258;
  const GLOW = "#5ad1ff"; // brillo tipo LED de ojos/detalles

  const frame =
    `<circle cx="250" cy="250" r="230" fill="${DARK}" fill-opacity="0.62"/>` +
    `<circle cx="250" cy="250" r="230" fill="none" stroke="url(#brandGrad)" stroke-width="10"/>`;

  // Sombra suave debajo del personaje, para que no se sienta "flotando".
  const shadow = `<ellipse cx="${cx}" cy="410" rx="120" ry="20" fill="#000" opacity="0.35" filter="url(#softBlur)"/>`;

  // Hombros / cuerpo: carcasa blanca brillante con panel de marca al pecho.
  const body =
    `<path d="M 130 400 Q 250 320 370 400 L 370 430 Q 250 400 130 430 Z" fill="url(#shellGrad)" stroke="#b9bfcd" stroke-width="3"/>` +
    `<path d="M 205 355 Q 250 372 295 355 L 288 410 Q 250 422 212 410 Z" fill="url(#brandGrad)"/>`;

  // Orejas/sensores laterales — anillos parcialmente visibles.
  const earL = `<circle cx="118" cy="270" r="30" fill="#c9ceda"/><circle cx="118" cy="270" r="18" fill="url(#shellGrad)"/>`;
  const earR = `<circle cx="382" cy="270" r="30" fill="#c9ceda"/><circle cx="382" cy="270" r="18" fill="url(#shellGrad)"/>`;

  // Cabeza: domo grande y redondeado, con degrade tipo plastico brillante
  // y un brillo especular arriba a la izquierda (como luz reflejada).
  const head = `<path d="M 130 250 Q 130 95 250 95 Q 370 95 370 250 Q 370 340 250 340 Q 130 340 130 250 Z" fill="url(#shellGrad)" stroke="#b9bfcd" stroke-width="3"/>`;
  const specular = `<ellipse cx="195" cy="150" rx="42" ry="24" fill="#ffffff" opacity="0.75" transform="rotate(-25 195 150)"/>`;

  // Antena con lucecita (cambia de color mientras "explica", como un
  // pequeno indicador de actividad).
  const antenna =
    `<line x1="250" y1="95" x2="250" y2="55" stroke="#c9ceda" stroke-width="8" stroke-linecap="round"/>` +
    `<circle cx="250" cy="46" r="12" fill="${pose === "explain" ? C1 : GLOW}"/>`;

  // Visor: panel oscuro grande que cubre casi toda la cara (no una franja
  // delgada), como en la referencia que mando el usuario.
  const visor = `<path d="M 158 210 Q 158 150 250 150 Q 342 150 342 210 L 342 275 Q 342 320 250 320 Q 158 320 158 275 Z" fill="url(#visorGrad)"/>`;

  // Ojos grandes con halo de brillo detras — la seña mas caracteristica
  // del diseno de referencia. Varian de forma segun la pose.
  let eyes;
  if (pose === "thumbsup") {
    eyes =
      `<ellipse cx="205" cy="235" rx="34" ry="30" fill="url(#eyeGlow)"/>` +
      `<ellipse cx="295" cy="235" rx="34" ry="30" fill="url(#eyeGlow)"/>` +
      `<path d="M 183 235 Q 205 215 227 235" fill="none" stroke="${GLOW}" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M 273 235 Q 295 215 317 235" fill="none" stroke="${GLOW}" stroke-width="9" stroke-linecap="round"/>`;
  } else if (pose === "explain") {
    eyes =
      `<ellipse cx="205" cy="238" rx="30" ry="34" fill="url(#eyeGlow)"/>` +
      `<ellipse cx="295" cy="238" rx="30" ry="34" fill="url(#eyeGlow)"/>` +
      `<ellipse cx="205" cy="240" rx="15" ry="19" fill="#eafcff"/>` +
      `<ellipse cx="295" cy="240" rx="15" ry="19" fill="#eafcff"/>`;
  } else {
    eyes =
      `<ellipse cx="205" cy="235" rx="30" ry="34" fill="url(#eyeGlow)"/>` +
      `<ellipse cx="295" cy="235" rx="30" ry="34" fill="url(#eyeGlow)"/>` +
      `<ellipse cx="205" cy="235" rx="15" ry="19" fill="#eafcff"/>` +
      `<ellipse cx="295" cy="235" rx="15" ry="19" fill="#eafcff"/>`;
  }

  // Boca: sonrisa curva brillante, siempre presente (como en la
  // referencia), que se ensancha un poco cuando "habla" (mouthOpen) — el
  // mismo ciclo de dos cuadros que se usaba con la boca tipo ecualizador.
  const mouth = mouthOpen
    ? `<path d="M 205 285 Q 250 308 295 285" fill="none" stroke="${GLOW}" stroke-width="9" stroke-linecap="round"/>`
    : `<path d="M 210 283 Q 250 298 290 283" fill="none" stroke="${GLOW}" stroke-width="7" stroke-linecap="round"/>`;

  let accessory = "";
  if (pose === "idle") {
    // mano robotica saludando
    accessory =
      `<g transform="translate(392,300) rotate(-12)">` +
      `<rect x="-16" y="-46" width="32" height="60" rx="16" fill="url(#shellGrad)" stroke="#b9bfcd" stroke-width="2"/>` +
      `</g>`;
  } else if (pose === "explain") {
    // mano robotica senalando hacia el grafico
    accessory =
      `<g transform="translate(78,320)">` +
      `<rect x="-60" y="-16" width="70" height="32" rx="16" fill="url(#shellGrad)" stroke="#b9bfcd" stroke-width="2"/>` +
      `</g>`;
  } else if (pose === "thumbsup") {
    accessory =
      `<g transform="translate(395,290) rotate(-10)">` +
      `<rect x="-22" y="-8" width="44" height="42" rx="14" fill="url(#shellGrad)" stroke="#b9bfcd" stroke-width="2"/>` +
      `<rect x="-12" y="-40" width="18" height="36" rx="9" fill="url(#shellGrad)" stroke="#b9bfcd" stroke-width="2"/>` +
      `</g>`;
  }

  const glowRing =
    pose === "explain"
      ? `<circle cx="${cx}" cy="${cy}" r="230" fill="none" stroke="${C1}" stroke-width="4" stroke-opacity="0.55"/>`
      : "";

  const inner = [frame, shadow, body, earL, earR, head, specular, antenna, visor, eyes, mouth, accessory, glowRing].join("");

  return svgWrap(inner);
}

// Genera los PNG (con fondo transparente fuera del circulo) de todas las
// combinaciones de pose/boca que necesita el video: boca abierta y
// cerrada para "idle" y "explain" (para el ciclo de "hablando"), y una
// sola imagen fija para "thumbsup" (gesto de cierre, sin animar boca).
// style: "photo" (por defecto ahora — la foto que genero el usuario con
// IA), "robot" (el dibujo vectorial, por si se quiere volver a el) o
// "bull" (la mascota toro original). En "photo" las 5 variantes son la
// misma imagen (no hay boca animada cuadro a cuadro posible con una sola
// foto); el "efecto de vida" se agrega despues, en el video, con un pulso
// de brillo (ver buildReelVideo).
export async function renderCharacterFrames({ style = "photo" } = {}) {
  const variants = [
    { key: "idle_open", pose: "idle", mouthOpen: true },
    { key: "idle_closed", pose: "idle", mouthOpen: false },
    { key: "explain_open", pose: "explain", mouthOpen: true },
    { key: "explain_closed", pose: "explain", mouthOpen: false },
    { key: "thumbsup", pose: "thumbsup", mouthOpen: false },
  ];

  if (style === "photo") {
    const photoBuffer = await readFile(PHOTO_PATH);
    const images = {};
    for (const v of variants) images[v.key] = photoBuffer;
    return images;
  }

  const builder = style === "bull" ? buildBullSvg : buildRobotSvg;
  const images = {};
  await Promise.all(
    variants.map(async (v) => {
      const svg = builder(v);
      images[v.key] = await sharp(Buffer.from(svg)).png().toBuffer();
    })
  );
  return images;
}
