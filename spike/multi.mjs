// Sửa NHIỀU dòng liên tiếp trên cùng một tài liệu rồi kiểm mọi chữ đã sửa vẫn tìm/copy được (bắt lỗi ghi đè ToUnicode).
// node spike/multi.mjs [--real]
import * as mupdf from 'mupdf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { useMupdf, lineInfo, editLine } from '../src/edit.mjs';
useMupdf(mupdf);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const loadFont = (f) => fs.readFileSync(path.join(HERE, '..', 'fonts', f));
const dir = path.join(HERE, process.argv.includes('--real') ? 'samples/real' : 'samples');
const words = (t) => t.normalize('NFC').split(/\s+/).filter(Boolean);
let bad = 0, total = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.pdf'))) {
  const doc = mupdf.Document.openDocument(fs.readFileSync(path.join(dir, f)), 'application/pdf').asPDF();
  const pages = Math.min(doc.countPages(), 3);
  for (let pi = 0; pi < pages; pi++) {
    const want = [];
    for (let k = 0; k < 4; k++) {
      const pg = doc.loadPage(pi); const L = lineInfo(pg); pg.destroy();
      const cands = L.filter((l) => l.text.split(' ').length >= 3 && !want.some((w) => w.text === l.text));
      if (!cands.length) break;
      const l = cands[Math.floor(cands.length * (k + 1) / 5)] || cands[0];
      const t = l.text + (k % 2 ? ' sửa' : ' mới');
      const r = editLine(doc, pi, l.i, t, { loadFont });
      if (r.status === 'ok' && !r.overflow) want.push({ text: t });
      total++;
    }
    const pg = doc.loadPage(pi); const bag = new Map(); for (const w of words(lineInfo(pg).map((x) => x.text).join(' '))) bag.set(w, (bag.get(w) || 0) + 1); pg.destroy();
    for (const w of want) {
      const need = new Map(); for (const x of words(w.text)) need.set(x, (need.get(x) || 0) + 1);
      const miss = [...need].filter(([x, c]) => (bag.get(x) || 0) < c).map(([x]) => x);
      if (miss.length) { bad++; console.log(`✗ ${f} p${pi + 1}: thiếu ${JSON.stringify(miss.slice(0, 5))} trong "${w.text.slice(0, 50)}"`); }
    }
  }
  doc.destroy(); if (globalThis.gc) globalThis.gc();
}
console.log(`${total} lần sửa liên tiếp · ${bad} dòng hỏng sau các lần sửa kế tiếp`);
