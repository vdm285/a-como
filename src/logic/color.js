// The one scale on the stage: a diverging ramp around the city median, computed in OKLab so
// the two arms step evenly. Cool pole = cheaper, warm pole = dearer, neutral grey = at the
// median. No red/green semaphore: red/green is the common colour-blindness pair and the
// dataviz rule for polarity is two hues plus a grey midpoint.

const CHEAPER = '#3987e5';
const DEARER = '#e66767';
const MID = '#5b616a';

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); }
function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function linearToSrgb(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; }
function rgbToOklab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [R, G, B].map((c) => Math.max(0, Math.min(1, linearToSrgb(c))));
}
function toHex(rgb) { return '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join(''); }

const LAB = { cheaper: rgbToOklab(hexToRgb(CHEAPER)), dearer: rgbToOklab(hexToRgb(DEARER)), mid: rgbToOklab(hexToRgb(MID)) };
const cache = new Map();

// t in [-1, 1]: -1 = fully cheaper, 0 = median, 1 = fully dearer. Returns a hex.
export function divergingColor(t) {
  if (t == null || !Number.isFinite(t)) return null;
  const k = Math.round(Math.max(-1, Math.min(1, t)) * 40) / 40;
  let hex = cache.get(k);
  if (hex) return hex;
  const pole = k < 0 ? LAB.cheaper : LAB.dearer;
  const a = Math.abs(k);
  // ease the arm so small deviations are visible but the midpoint stays grey
  const e = Math.pow(a, 0.8);
  const lab = LAB.mid.map((v, i) => v + (pole[i] - v) * e);
  hex = toHex(oklabToRgb(lab));
  cache.set(k, hex);
  return hex;
}

// CSS gradient for the legend bar, cheaper → median → dearer.
export function divergingGradient() {
  const stops = [];
  for (let i = -1; i <= 1.001; i += 0.25) stops.push(`${divergingColor(i)} ${((i + 1) / 2 * 100).toFixed(0)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export const COLORS = { CHEAPER, DEARER, MID };
