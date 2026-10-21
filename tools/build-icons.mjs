// Rasterises public/favicon.svg into the PNG icons the manifest lists. Run by hand when the
// icon changes: node tools/build-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const svg = readFileSync(resolve('public/favicon.svg'));
for (const size of [192, 512]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(resolve(`public/icon-${size}.png`));
  console.log(`public/icon-${size}.png`);
}
