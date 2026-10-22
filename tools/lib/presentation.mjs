// Size parser for PROFECO "Quién es Quién en los Precios" PRESENTACIÓN strings.
// Built from the real vocabulary (5,268 distinct strings in QQP 2025-2026, see
// docs/research/profeco-qqp-2026-10.md). Returns { value, unit, pack? } or null.
//   unit  'g' (grams), 'ml' (millilitres) or 'pza' (pieces); value is the TOTAL in the package
//   pack  number of units in a multipack, only when one was detected and is > 1
// Pure function, no dependencies; the same code runs in the build and in the app.
//
// Rules, in priority order (each example is a real string from the data):
//  1. "N PACK X unit" / "N x X unit"                      -> N * X          "6 Pack 355 Ml."
//  2. "N <container> [de|con] X unit [c/u]"              -> N * X          "Canasta con 6 Botellas de 355 Ml."
//     "N <pieces> de X unit" or "... X unit c/u"         -> N * X          "Paquete 4 Pzas. 200 Gr. C/U"
//     "N <pieces>. X unit" (no de / c/u)                 -> X, pack N      "Bolsa 15 Piezas. 382.5 Gr."
//     "N <container> (X unit C/U)"                       -> N * X          "Caja con 25 Sobres (1.2 Gr. C/U)"
//  3. "N <dose form>" (tabletas, cápsulas, ...)          -> N pza          "Caja con 30 Tabletas de 50 Mg."
//  4. "N rollos"                                         -> N pza          "Paquete 4 Rollos. 200 Hojas Dobles"
//  5. first "X unit" in the text                         -> X              "Botella 1.5 Lt.", "1 Kg. Granel"
//  6. "C/N", "N piezas", "N hojas", ...                  -> N pza          "Paquete C/18 Blanco", "100 Hojas"
//  7. bare "Pieza", "Pza", "Manojo"                      -> 1 pza          "Pieza. Romana", "Manojo"
// Doses (mg, mcg, "875/125 Mg.", "1 Gr./100 Gr.", "Mg./ml") are removed before parsing so a
// tablet's strength is never taken as the package weight. Weight ranges ("de 68 a 90 Gr.") are
// ignored. A thousands comma ("10,000 Horas") is removed; a decimal comma ("1,5 Lt.") is a point.
// A point followed by exactly three digits before grams or millilitres is a thousands separator
// ("Bolsa 3.564 Gr." is 3,564 g of detergent, 47 pesos a kilo like its siblings); before kilos or
// litres it stays a decimal ("Botella 3.785 Lt." is a US gallon). The data behind both readings:
// docs/research/profeco-qqp-2026-10.md §20.

const WEIGHT = { KG: 1000, KGS: 1000, KILO: 1000, KILOS: 1000, GR: 1, GRS: 1, G: 1, GRAMO: 1, GRAMOS: 1 };
const VOLUME = { LT: 1000, LTS: 1000, L: 1000, LITRO: 1000, LITROS: 1000, ML: 1, MLS: 1, MILILITRO: 1, MILILITROS: 1, CL: 10 };
const UNIT_RE = 'KG|KGS|KILOS?|GRS?|G|GRAMOS?|LTS?|L|LITROS?|MLS?|MILILITROS?|CL';
const PIECES_RE = 'PIEZASS?|PIEZA|PZAS?|PZS?'; // "Piezass" is a typo that occurs in the data
const DOSE_RE = 'TABLETAS?|TABS?|COMPRIMIDOS?|CAPSULAS?|CAPS|GRAGEAS?|OVULOS?|SUPOSITORIOS?|PARCHES?|PASTILLAS?|PERLAS?';
const COUNT_RE = 'HOJAS?|SOBRES?|SOBRECITOS?|BOLSITAS?|PLIEGOS?|TOALLAS?|TOALLITAS?|PANALES?|PANAL|SERVILLETAS?|VASOS?|PLATOS?|CUCHARAS?|TENEDORES?|CUCHILLOS?|POPOTES?|BARRAS?|REBANADAS?|UNIDADES?|CUBOS?|LATAS?|BOTELLAS?|CAJAS?|FRASCOS?|BOLSAS?|PAQUETES?|AMPOLLETAS?|JERINGAS?|CARTUCHOS?|REPUESTOS?|RASTRILLOS?|LAPICES|PLUMAS?|MARCADORES|CRAYONES|COLORES|CERILLOS?|VELAS?|TAMPONES|TOALLAS? SANITARIAS|PROTECTORES|APLICADORES|TIRAS?|PARES?|HUEVOS?|PANES|PIEZAS?|PZAS?'
  + '|CERAS?|DOSIS|DISPAROS?|PILAS?|BATERIAS?|FOCOS?|NAVAJAS?|RASURADORAS?|GLOBOS?|CLIPS?|BROCHES?|GOMAS?|BOLIGRAFOS?|PLUMONES|PINCELES|PANUELOS?|CALCETINES|PANTALETAS?|TRUSAS?|CAMISETAS?|CUADERNOS?|LIBRETAS?|REGLAS?|SACAPUNTAS|ETIQUETAS?|PANOS?|ESPONJAS?|FIBRAS?|GUANTES?|CONDONES|PRESERVATIVOS?|BOLILLOS?|TORTILLAS?|DONAS?|CONCHAS?|GALLETAS?|CHOCOLATES?|CHICLES?|PALETAS?|CEPILLOS?|HISOPOS?|CURITAS?|GASAS?|VENDAS?|INYECCIONES|BOMBONES|MALVAVISCOS|PANQUES|TOSTADAS|TAPAS?';
const CONTAINER_RE = 'BOTELLAS?|LATAS?|SOBRES?|SOBRECITOS?|CUBOS?|BOLSAS?|BOLSITAS?|FRASCOS?|CAJAS?|CAJITAS?|PAQUETES?|AMPOLLETAS?|JERINGAS?|TETRAPACKS?|ENVASES?|BOTES?|TUBOS?|VASOS?|BARRAS?|TARROS?|PIEZAS?|PZAS?|PZS?|UNIDADES?|LATITAS?|BRICKS?|BOLSAS? PLASTICO';

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalize(text) {
  let s = stripAccents(String(text)).toUpperCase();
  s = s.replace(/[Μμµ]/g, 'M');                 // Greek mu / micro sign in "27.5 Μg./50 Μl."
  s = s.replace(/\bC\.B\.?\s*\d+/g, ' ');                     // barcode "C.B. 415083"
  s = s.replace(/(\d)\+(\d+)/g, (m, a, b) => String(Number(a) + Number(b))); // "20+2 Piezas"
  s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2');                // thousands "10,000"
  // thousands point before small units only: "3.564 Gr." -> 3564 g; "3.785 Lt." stays 3.785 l
  s = s.replace(/(^|[^\d.,])([1-9]\d{0,2})\.(\d{3})(?=\s*(?:GRS?|G|GRAMOS?|MLS?|MILILITROS?)\b)/g, '$1$2$3');
  s = s.replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');             // decimal comma "1,5"
  // doses and concentrations never describe the package size
  s = s.replace(/\d+(\.\d+)?(\s*\/\s*\d+(\.\d+)?)*\s*(MG|MCG|UI|U\.I\.|MEQ)\.?(\s*\/\s*(\d+(\.\d+)?\s*)?(MG|MCG|ML|GR|G|UI|KG|LT|L)\.?)*/g, ' ');
  s = s.replace(/\d+(\.\d+)?\s*(GR|G)\.?\s*\/\s*100\s*(GR|G|ML)\.?/g, ' '); // "1 Gr./100 Gr."
  s = s.replace(/\d+(\.\d+)?\s*%/g, ' ');                      // "70 %"
  s = s.replace(/\bDE\s+\d+(\.\d+)?\s+A\s+\d+(\.\d+)?\s*(KG|GR|G|ML|LT|L)\.?/g, ' '); // weight ranges
  s = s.replace(/\d+(\.\d+)?\s*(CM|MM|M|MTS|PLGS|PULGADAS|W|KW|V|HZ|GB|TB|MP|HORAS|°|º)\b\.?/g, ' '); // dimensions, power, memory
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function toBase(valueStr, unitStr) {
  const v = Number(valueStr);
  const u = unitStr.toUpperCase();
  if (!(v > 0)) return null;
  if (u in WEIGHT) return { value: round(v * WEIGHT[u]), unit: 'g' };
  if (u in VOLUME) return { value: round(v * VOLUME[u]), unit: 'ml' };
  return null;
}

function round(n) { return Math.round(n * 1000) / 1000; }

function withPack(base, pack) {
  if (!base) return null;
  const out = { value: round(base.value * pack), unit: base.unit };
  if (pack > 1) out.pack = pack;
  return out;
}

/**
 * @param {string} text  PRESENTACIÓN as published, e.g. "Botella 850 Ml. Vegetal"
 * @returns {{ value: number, unit: 'g'|'ml'|'pza', pack?: number } | null}
 */
export function parsePresentation(text) {
  if (text == null) return null;
  const s = normalize(text);
  if (!s) return null;
  let m;

  // 1. "6 PACK 355 ML", "12 X 64 GR"
  m = new RegExp(`(?:^|[^\\d.])(\\d+)\\s*(?:PACK|X)\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})\\b`).exec(s);
  if (m) return withPack(toBase(m[2], m[3]), Number(m[1]));
  m = new RegExp(`(?:^|[^\\d.])(\\d+)\\s*PACK\\b[^\\d]*?(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})\\b`).exec(s);
  if (m) return withPack(toBase(m[2], m[3]), Number(m[1]));

  // 2a. "N <container> (X unit C/U)": the size in brackets is each one's -> "Caja con 25 Sobres (1.2 Gr. C/U)"
  m = new RegExp(`(?:^|[^\\d.])(\\d+)\\s+(${CONTAINER_RE})\\.?\\s*\\(\\s*(?:DE\\s+)?(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})\\b\\.?\\s*C\\s*\\/\\s*U\\b`).exec(s);
  if (m) { const base = toBase(m[3], m[4]); if (base) return withPack(base, Number(m[1])); }

  // 2. "N <container> [DE|CON] X unit [C/U]" and "N piezas de X unit"
  m = new RegExp(`(?:^|[^\\d.])(\\d+)\\s+(${CONTAINER_RE})\\.?\\s+(?:(DE|CON)\\s+)?(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})\\b\\.?(\\s*C\\s*\\/\\s*U)?`).exec(s);
  if (m) {
    const n = Number(m[1]);
    const noun = m[2];
    const each = Boolean(m[3] || m[6]) || !new RegExp(`^(${PIECES_RE}|UNIDADES?)$`).test(noun);
    const base = toBase(m[4], m[5]);
    if (base) {
      if (each) return withPack(base, n);
      return n > 1 ? { ...base, pack: n } : base;
    }
  }
  // "N cajas . M piezas C/U", "2 Cajas con 14 Cápsulas"
  m = new RegExp(`(?:^|[^\\d.])(\\d+)\\s+(${CONTAINER_RE})\\.?\\s+(?:(?:DE|CON)\\s+)?(\\d+)\\s+(${PIECES_RE}|${DOSE_RE}|${COUNT_RE})\\b`).exec(s);
  if (m && Number(m[1]) > 1) return withPack({ value: Number(m[3]), unit: 'pza' }, Number(m[1]));

  // 3. dose forms: the count of tablets is the size, the strength was removed above
  m = new RegExp(`(?:^|[^\\d.])(\\d+)\\s+(${DOSE_RE})\\b`).exec(s);
  if (m) return { value: Number(m[1]), unit: 'pza' };

  // 4. rolls: "4 Rollos. 200 Hojas Dobles" -> 4 pieces (sheets per roll vary and are often missing)
  m = /(?:^|[^\d.])(\d+)\s+ROLLOS?\b/.exec(s);
  if (m) return { value: Number(m[1]), unit: 'pza' };

  // 5. first plain size
  m = new RegExp(`(?:^|[^\\d.])(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})\\b`).exec(s);
  if (m) {
    const base = toBase(m[1], m[2]);
    if (base) {
      const p = /\(\s*(\d+)\s*PACK\s*\)/.exec(s); // "Paquete 400 Gr. (2 Pack)": the weight is the total
      return p && Number(p[1]) > 1 ? { ...base, pack: Number(p[1]) } : base;
    }
  }

  // 5b. sold by the kilo with no number: "Kg. Natural", "Paquete Contenido Variable. Kg. Seco"
  if (/(^|[\s.(])(KG|KILO)(\b|\.)/.test(s) && !/\d/.test(s.replace(/\bNO\.\s*\d+/g, ''))) return { value: 1000, unit: 'g' };

  // 6. piece counts
  m = /(?:^|\s)C\s*\/\s*(\d+)\b/.exec(s);                                   // "Paquete C/18 Blanco"
  if (m) return { value: Number(m[1]), unit: 'pza' };
  m = new RegExp(`(?:^|[^\\d.])(\\d+)\\s*(${PIECES_RE})\\b`).exec(s);
  if (m) return { value: Number(m[1]), unit: 'pza' };
  m = new RegExp(`(?:^|[^\\d.])(\\d+)\\s+(${COUNT_RE})\\b`).exec(s);
  if (m) return { value: Number(m[1]), unit: 'pza' };
  m = /\b(?:PAQUETE|ESTUCHE|CAJA|BOLSA|BLISTER|CANASTILLA|TUBO|FRASCO|BOTE|DISPLAY)\s+CON\s+(\d+)\.?(?:\s|$|\))/.exec(s); // "Paquete con 2. Venus"
  if (m) return { value: Number(m[1]), unit: 'pza' };

  // 7. a single piece
  if (/(^|[\s.(])(PIEZA|PZA|PZ|MANOJO|RACIMO|ATADO|UNIDAD|ROLLO|SOBRE)(\b|\.)/.test(s)) return { value: 1, unit: 'pza' };
  return null;
}

export default parsePresentation;
