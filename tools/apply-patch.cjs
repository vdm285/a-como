// Applies plain-text patches: blocks of "<<<< file", the old text, "====", the new text, ">>>>".
// No escaping needed (Git Bash heredocs break on backticks); each old text must occur exactly once,
// and nothing is written unless every block applies. Run: node tools/apply-patch.cjs <patch.txt>
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const re = /^<<<< (.+)\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>$/gm;
let m, n = 0; const files = new Map();
while ((m = re.exec(src))) {
  const [, file, a, b] = m;
  let s = files.has(file) ? files.get(file) : fs.readFileSync(file, 'utf8');
  const i = s.indexOf(a);
  if (i < 0) throw new Error(`missing in ${file}: ${a.slice(0, 120)}`);
  if (s.indexOf(a, i + 1) >= 0) throw new Error(`ambiguous in ${file}: ${a.slice(0, 120)}`);
  s = s.slice(0, i) + b + s.slice(i + a.length);
  files.set(file, s); n++;
}
for (const [file, s] of files) fs.writeFileSync(file, s);
console.log(`${n} hunks applied to ${[...files.keys()].join(', ')}`);
