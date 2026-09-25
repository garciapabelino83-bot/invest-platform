import sharp from "sharp";

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

// Mascota "Robot analista" — mismo marco circular y mismo sistema de
// poses/animacion que el toro, pero con look de robot/IA (cabeza redonda
// blanca, ojos con brillo tipo LED, antena) en vez de un animal. Es un
// diseno propio (no copia el logo ni la marca de ningun exchange real)
// pero en el mismo estilo "asistente de IA amigable" que pidio el
// usuario, combinado con los colores de InvestPanel (naranja) para que
// se sienta parte de la misma marca.
function buildRobotSvg({ pose = "idle", mouthOpen = false } = {}) {
  const cx = 250,
    cy = 250;
  const GLOW = "#5ad1ff"; // brillo tipo LED de ojos/detalles
  const SHELL = "#eef1f5"; // carcasa blanca/plateada
  const SHELL_SHADOW = "#c7ccd6";

  const frame =
    `<circle cx="${cx}" cy="${cy}" r="230" fill="${DARK}" fill-opacity="0.62"/>` +
    `<circle cx="${cx}" cy="${cy}" r="230" fill="none" stroke="url(#brandGrad)" stroke-width="10"/>`;

  // Hombros / cuerpo: carcasa blanca con un panel en el pecho en naranja
  // de marca (como un pequeno logo/indicador).
  const body =
    `<path d="M 85 475 Q 250 335 415 475 L 415 500 L 85 500 Z" fill="${SHELL}" stroke="${SHELL_SHADOW}" stroke-width="4"/>` +
    `<rect x="228" y="380" width="44" height="34" rx="10" fill="url(#brandGrad)"/>`;

  // Antena
  const antenna =
    `<line x1="250" y1="118" x2="250" y2="80" stroke="${SHELL_SHADOW}" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="250" cy="70" r="14" fill="${GLOW}"/>`;

  // Orejas/auriculares laterales (sensores de audio)
  const earL = `<rect x="98" y="238" width="26" height="64" rx="13" fill="${SHELL_SHADOW}"/>`;
  const earR = `<rect x="376" y="238" width="26" height="64" rx="13" fill="${SHELL_SHADOW}"/>`;

  // Cabeza: capsula redondeada
  const head = `<rect x="132" y="120" width="236" height="220" rx="90" fill="${SHELL}" stroke="${SHELL_SHADOW}" stroke-width="4"/>`;

  // Visor/pantalla de la cara, mas oscuro, donde van los ojos y la boca
  const visor = `<rect x="162" y="192" width="176" height="118" rx="46" fill="#161a22"/>`;

  // Ojos: arcos con brillo tipo LED. En "thumbsup" se cierran felices
  // (arco hacia abajo), igual gesto que el resto de las poses pero con
  // un pequeno "destello" extra para dar sensacion de alegria.
  let eyes;
  if (pose === "thumbsup") {
    eyes =
      `<path d="M 198 245 Q 213 230 228 245" fill="none" stroke="${GLOW}" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M 272 245 Q 287 230 302 245" fill="none" stroke="${GLOW}" stroke-width="9" stroke-linecap="round"/>`;
  } else if (pose === "explain") {
    // ojos entrecerrados/concentrados: arcos mas planos
    eyes =
      `<path d="M 196 240 Q 213 248 230 240" fill="none" stroke="${GLOW}" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M 270 240 Q 287 248 304 240" fill="none" stroke="${GLOW}" stroke-width="9" stroke-linecap="round"/>`;
  } else {
    eyes =
      `<circle cx="213" cy="243" r="15" fill="${GLOW}"/>` +
      `<circle cx="287" cy="243" r="15" fill="${GLOW}"/>`;
  }

  // Boca: barra de "luces" tipo ecualizador — mas ancha/alta cuando
  // "habla" (mouthOpen), fina cuando esta cerrada.
  const mouth = mouthOpen
    ? `<rect x="205" y="275" width="90" height="20" rx="10" fill="${GLOW}"/>` +
      `<rect x="215" y="270" width="10" height="30" rx="5" fill="#0a0b0e" opacity="0.35"/>` +
      `<rect x="240" y="270" width="10" height="30" rx="5" fill="#0a0b0e" opacity="0.35"/>` +
      `<rect x="265" y="270" width="10" height="30" rx="5" fill="#0a0b0e" opacity="0.35"/>` +
      `<rect x="290" y="270" width="8" height="30" rx="4" fill="#0a0b0e" opacity="0.35"/>`
    : `<rect x="212" y="282" width="76" height="10" rx="5" fill="${GLOW}"/>`;

  let accessory = "";
  if (pose === "idle") {
    // mano robotica saludando
    accessory =
      `<g transform="translate(382,330) rotate(-10)">` +
      `<rect x="-24" y="-30" width="48" height="60" rx="18" fill="${SHELL}" stroke="${SHELL_SHADOW}" stroke-width="3"/>` +
      `</g>`;
  } else if (pose === "explain") {
    // mano robotica senalando hacia el grafico
    accessory =
      `<g transform="translate(66,362)">` +
      `<rect x="-60" y="-16" width="70" height="32" rx="16" fill="${SHELL}" stroke="${SHELL_SHADOW}" stroke-width="3"/>` +
      `</g>`;
  } else if (pose === "thumbsup") {
    accessory =
      `<g transform="translate(392,335) rotate(-8)">` +
      `<rect x="-24" y="-8" width="48" height="46" rx="16" fill="${SHELL}" stroke="${SHELL_SHADOW}" stroke-width="3"/>` +
      `<rect x="-14" y="-42" width="20" height="40" rx="10" fill="${SHELL}" stroke="${SHELL_SHADOW}" stroke-width="3"/>` +
      `</g>`;
  }

  const glowRing =
    pose === "explain"
      ? `<circle cx="${cx}" cy="${cy}" r="230" fill="none" stroke="${GLOW}" stroke-width="4" stroke-opacity="0.55"/>`
      : "";

  const inner = [frame, body, antenna, earL, earR, head, visor, eyes, mouth, accessory, glowRing].join("");

  return svgWrap(inner);
}

// Genera los PNG (con fondo transparente fuera del circulo) de todas las
// combinaciones de pose/boca que necesita el video: boca abierta y
// cerrada para "idle" y "explain" (para el ciclo de "hablando"), y una
// sola imagen fija para "thumbsup" (gesto de cierre, sin animar boca).
// style: "robot" (por defecto, look de asistente de IA) o "bull" (la
// mascota toro original) — mismo sistema de poses en ambos casos, asi
// que cambiar de uno a otro no requiere tocar nada mas del video.
export async function renderCharacterFrames({ style = "robot" } = {}) {
  const builder = style === "bull" ? buildBullSvg : buildRobotSvg;
  const variants = [
    { key: "idle_open", pose: "idle", mouthOpen: true },
    { key: "idle_closed", pose: "idle", mouthOpen: false },
    { key: "explain_open", pose: "explain", mouthOpen: true },
    { key: "explain_closed", pose: "explain", mouthOpen: false },
    { key: "thumbsup", pose: "thumbsup", mouthOpen: false },
  ];

  const images = {};
  await Promise.all(
    variants.map(async (v) => {
      const svg = builder(v);
      images[v.key] = await sharp(Buffer.from(svg)).png().toBuffer();
    })
  );
  return images;
}
