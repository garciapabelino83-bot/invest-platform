// Lista compartida de monedas (id de CoinGecko + nombre) que usan las
// herramientas nuevas (convertidor y comparador). Es la misma lista de
// ALL_COINS que ya vive en src/app/page.tsx para "Mi lista" — la repetimos
// acá en un archivo propio para no tener que importar un componente
// "use client" desde rutas de API del servidor.
export const MONEDAS: { id: string; label: string }[] = [
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

export const MONEDAS_IDS_VALIDOS = new Set(MONEDAS.map((m) => m.id));

// Monedas fiat (con nombre en español) que ofrece el convertidor, además
// de las criptos de arriba. Usamos los códigos que acepta la API gratuita
// de tipos de cambio (open.er-api.com) y, para el precio en USD de cada
// cripto, la API de CoinGecko.
export const FIAT: { code: string; label: string }[] = [
  { code: "USD", label: "Dólar estadounidense (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "ARS", label: "Peso argentino (ARS)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "UYU", label: "Peso uruguayo (UYU)" },
  { code: "BOB", label: "Boliviano (BOB)" },
  { code: "GTQ", label: "Quetzal guatemalteco (GTQ)" },
  { code: "DOP", label: "Peso dominicano (DOP)" },
  { code: "BRL", label: "Real brasileño (BRL)" },
  { code: "GBP", label: "Libra esterlina (GBP)" },
  { code: "CAD", label: "Dólar canadiense (CAD)" },
];
