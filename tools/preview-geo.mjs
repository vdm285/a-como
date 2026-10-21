// Renders public/data/geo/cdmx.json the way the app will (d3-geo Mercator, fitted) into
// data/cache/geo/check.svg and check.png, for a human eye. Run: node tools/preview-geo.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import sharp from 'sharp';

const geo = JSON.parse(readFileSync('public/data/geo/cdmx.json', 'utf8'));
const W = 1600, H = 1000;
const projection = geoMercator().fitExtent([[40, 40], [W - 40, H - 40]], geo.alcaldias);
const path = geoPath(projection);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const layer = (fc, style) => (fc && fc.features ? fc.features.map((f) => `<path d="${path(f)}" style="${style}"><title>${esc(f.properties.name || '')}</title></path>`).join('') : '');
const labels = geo.alcaldias.features.map((f) => { const c = projection(geoCentroid(f)); return `<text x="${c[0].toFixed(1)}" y="${c[1].toFixed(1)}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.35)" font-family="sans-serif">${esc(f.properties.name)}</text>`; }).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#0c1118"/>
${layer(geo.zmvm, 'fill:rgba(255,255,255,0.012);stroke:rgba(255,255,255,0.08);stroke-width:1')}
${layer(geo.alcaldias, 'fill:rgba(255,255,255,0.03);stroke:rgba(255,255,255,0.14);stroke-width:1')}
${layer(geo.green, 'fill:rgba(72,140,96,0.16)')}
${layer(geo.water, 'fill:rgba(70,130,210,0.2)')}
${layer(geo.airport, 'fill:rgba(255,255,255,0.05)')}
${layer(geo.roads, 'fill:none;stroke:rgba(255,255,255,0.14);stroke-width:1.4;stroke-linecap:round')}
${labels}
<text x="12" y="${H - 12}" font-size="11" fill="#889" font-family="sans-serif">${esc(geo.meta.attribution)} · built ${geo.meta.built}</text>
</svg>`;
writeFileSync('data/cache/geo/check.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('data/cache/geo/check.png');
const b = path.bounds(geo.alcaldias);
console.log('check.svg + check.png written; alcaldías bounds px', b.map((p) => p.map((v) => v.toFixed(0))).join(' .. '));
for (const k of ['alcaldias', 'zmvm', 'roads', 'green', 'water', 'airport']) console.log(k, geo[k] ? geo[k].features.length : 'MISSING');
