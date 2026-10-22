#!/usr/bin/env node
// tools/mirror-qqp.mjs — refresh the byte-for-byte mirror of PROFECO's yearly QQP archives.
//
// Why: datos.profeco.gob.mx answers 404 to GitHub's runners (US IPs), so the weekly Pages build
// cannot download the archives itself. Run this from a network that reaches PROFECO (any home
// connection in Mexico): it downloads the current archives (tools/build-qqp.mjs --download-only),
// and uploads the ones that changed to the release `qqp-mirror` on this repository, with a
// mirror.json index (bytes, sha256, the date PROFECO was accessed, the source URL). The build
// verifies each file's sha256 against that index. The data's licence (CC BY 4.0 on datos.gob.mx;
// Libre Uso MX) permits distributing copies with credit; the release notes carry it.
//
//   node tools/mirror-qqp.mjs [--years=2026,2025] [--dry-run]
//
// Needs the GitHub CLI (`gh`) logged in with write access to the repository.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'cache', 'qqp', 'raw');
const REPO = 'vdm285/a-como';
const TAG = 'qqp-mirror';
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const yearsArg = args.find((a) => a.startsWith('--years='));
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);
const run = (cmd, a, opts = {}) => spawnSync(cmd, a, { encoding: 'utf8', windowsHide: true, ...opts });

// 1. fetch from PROFECO (the pipeline refreshes the current year when its copy is stale)
const dl = run(process.execPath, [path.join(ROOT, 'tools', 'build-qqp.mjs'), '--download-only', ...(yearsArg ? [yearsArg] : [])], { stdio: 'inherit' });
if (dl.status !== 0) { log('download step failed; nothing mirrored'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(RAW, 'manifest.json'), 'utf8'));
const names = Object.keys(manifest).filter((n) => /^QQP_\d{4}\.rar$/.test(n) && fs.existsSync(path.join(RAW, n)));
const direct = names.filter((n) => manifest[n].via !== 'mirror');
if (!direct.length) { log('no archive came from PROFECO directly (is this network blocked too?); nothing to mirror'); process.exit(1); }

// 2. what the release holds now
let current = { files: {} };
const view = run('gh', ['release', 'view', TAG, '--repo', REPO, '--json', 'assets']);
const exists = view.status === 0;
if (exists) {
  const dlIdx = run('gh', ['release', 'download', TAG, '--repo', REPO, '--pattern', 'mirror.json', '--output', '-']);
  if (dlIdx.status === 0 && dlIdx.stdout.trim()) { try { current = JSON.parse(dlIdx.stdout); } catch { /* treat as empty */ } }
}

// 3. the new index; upload only what changed
const index = { source: 'PROFECO, "Quién es Quién en los Precios", https://datos.profeco.gob.mx/datos_abiertos/qqp.php', license: 'Creative Commons Attribution 4.0 (datos.gob.mx); Términos de Libre Uso MX', updated: new Date().toISOString(), files: { ...(current.files || {}) } };
const changed = [];
for (const n of direct) {
  const m = manifest[n];
  const prev = index.files[n];
  index.files[n] = { bytes: m.bytes, sha256: m.sha256, retrieved: m.retrieved, url: m.url };
  if (!prev || prev.sha256 !== m.sha256) changed.push(n);
  else index.files[n].retrieved = m.retrieved; // same bytes, newer access date
}
const idxFile = path.join(RAW, 'mirror.json');
fs.writeFileSync(idxFile, JSON.stringify(index, null, 2));
log(`changed: ${changed.join(', ') || 'none'}; index updated for ${direct.join(', ')}`);
if (dry) { log('dry run: nothing uploaded'); process.exit(0); }

if (!exists) {
  const notes = [
    'Byte-for-byte copies of PROFECO\'s yearly "Quién es Quién en los Precios" archives, for the weekly build of A cómo.',
    '',
    'Source: "Programa Quién es Quién en los Precios", PROFECO (Procuraduría Federal del Consumidor), https://datos.profeco.gob.mx/datos_abiertos/qqp.php. Each file\'s access date and sha256 are in mirror.json.',
    'Licence: Creative Commons Attribution 4.0, as stated for these datasets on datos.gob.mx (Términos de Libre Uso MX). This mirror and the app are not made or endorsed by PROFECO.',
    '',
    'Why a mirror: datos.profeco.gob.mx does not answer GitHub\'s build servers. Refreshed with tools/mirror-qqp.mjs from a network in Mexico.',
  ].join('\n');
  const c = run('gh', ['release', 'create', TAG, '--repo', REPO, '--title', 'PROFECO QQP mirror', '--notes', notes, '--latest=false'], { stdio: 'inherit' });
  if (c.status !== 0) { log('could not create the release'); process.exit(1); }
}
const up = run('gh', ['release', 'upload', TAG, '--repo', REPO, '--clobber', ...changed.map((n) => path.join(RAW, n)), idxFile], { stdio: 'inherit' });
if (up.status !== 0) { log('upload failed'); process.exit(1); }
log(`mirrored ${changed.length} archive(s) and mirror.json to https://github.com/${REPO}/releases/tag/${TAG}`);
