// Thử sửa MỌI dòng của mọi file theo nhiều kiểu để tìm chỗ vỡ (ngoại lệ) và chỗ mất chữ.
// node --expose-gc spike/fuzz.mjs [--real]
import * as mupdf from 'mupdf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { useMupdf, lineInfo, editLine } from '../src/edit.mjs';
useMupdf(mupdf);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const loadFont = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f));
const dir = path.join(HERE, process.argv.includes('--real') ? 'samples/real' : 'samples');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));
const MUT = {
  append: (t) => t + ' mới',
  prepend: (t) => 'Mới ' + t,
  midword: (t) => { const w = t.split(' '); if (w.length < 3) return t + ' x'; w[Math.floor(w.length / 2)] = 'thử nghiệm'; return w.join(' '); },
  shorten: (t) => (t.length > 6 ? t.slice(0, Math.ceil(t.length * 0.6)) : t + '!'),
  delete: () => '',
};
let total = 0, ok = 0, warned = 0; const errors = new Map(), lost = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f));
  const base = mupdf.Document.openDocument(src, 'application/pdf');
  const pages = Math.min(base.countPages(), 4);
  for (let pi = 0; pi < pages; pi++) {
    const bp = base.loadPage(pi); const L = lineInfo(bp).slice(0, 14); bp.destroy();
    for (const l of L) for (const [m, fn] of Object.entries(MUT)) {
      total++;
      const doc = mupdf.Document.openDocument(src, 'application/pdf').asPDF();
      const want = fn(l.text);
      try {
        const r = editLine(doc, pi, l.i, want, { loadFont });
        if (r.status === 'ok' || r.status === 'unchanged') {
          ok++;
          if (r.overflow) warned++; // chữ quá dài cho chỗ trống: giao diện đã cảnh báo, không tính là mất chữ
          else if (want.trim() && r.status === 'ok') {
            const ap = doc.loadPage(pi); const afterL = lineInfo(ap); ap.destroy();
            // so theo TỪ (đếm số lần xuất hiện) để không báo nhầm khi thứ tự dòng đổi sau khi dàn lại đoạn
            const words = (t) => t.normalize('NFC').split(/\s+/).filter(Boolean);
            const bag = new Map(); for (const w of words(afterL.map((x) => x.text).join(' '))) bag.set(w, (bag.get(w) || 0) + 1);
            const need = new Map(); for (const w of words(want)) need.set(w, (need.get(w) || 0) + 1);
            const miss = [...need].filter(([w, n]) => (bag.get(w) || 0) < n).map(([w]) => w);
            if (miss.length) lost.push(`${f} p${pi + 1} L${l.i} ${m}: thiếu ${JSON.stringify(miss.slice(0, 4))} trong "${want.slice(0, 40)}"`);
          }
        } else if (!['not-found', 'no-font'].includes(r.status)) errors.set(r.status, (errors.get(r.status) || []).concat(`${f} p${pi + 1} L${l.i} ${m}`));
      } catch (e) {
        doc.__err = true;
        const k = String(e.message).slice(0, 90) + ' @ ' + (String(e.stack).split('\n').find((s) => s.includes('edit.mjs')) || '').trim().replace(/.*edit\.mjs:/, 'edit.mjs:');
        errors.set(k, (errors.get(k) || []).concat(`${f} p${pi + 1} L${l.i} ${m}`));
      }
      try { doc.destroy(); } catch { /* ignore */ }
      if (total % 20 === 0 && globalThis.gc) globalThis.gc(); // lưới an toàn: dọn wrapper JS còn giữ đối tượng WASM
    }
  }
}
console.log(`tổng ${total} lần sửa · ${ok} ok (trong đó ${warned} tràn có cảnh báo) · ${[...errors.values()].reduce((a, v) => a + v.length, 0)} lỗi · ${lost.length} mất chữ`);
for (const [k, v] of errors) console.log(`\n✗ ${k}\n   ${v.length} lần, ví dụ: ${v.slice(0, 4).join(' | ')}`);
if (lost.length) console.log('\nMất chữ:\n  ' + lost.slice(0, 15).join('\n  '));
