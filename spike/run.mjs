// Chạy bộ thử chất lượng sửa chữ gốc: node spike/run.mjs
// Mỗi ca: mở file gốc, sửa, lưu, rồi kiểm tra bằng hai trình đọc độc lập (MuPDF và pdf.js),
// so điểm ảnh ngoài vùng sửa (phải = 0 nếu bố cục giữ nguyên), cắt ảnh trước/sau vào spike/report/.
import * as mupdf from 'mupdf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { replaceText, pageText } from './lib/edit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// --real: chạy với PDF thật trong spike/samples/real/ (không commit), báo cáo ra spike/report-real/ (không commit)
const REAL = process.argv.includes('--real');
const SAMPLES = path.join(HERE, REAL ? 'samples/real' : 'samples');
const REPORT = path.join(HERE, REAL ? 'report-real' : 'report');
const OUTPDF = path.join(HERE, REAL ? 'out-real' : 'out');
fs.mkdirSync(REPORT, { recursive: true }); fs.mkdirSync(OUTPDF, { recursive: true });
const NFC = (s) => String(s).normalize('NFC');
const count = (hay, needle) => NFC(hay).split(NFC(needle)).length - 1;
const loadFont = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f));
const SCALE = 2;

// pdf.js (trình đọc PDF của Firefox, dùng trong extension) làm trình đọc thứ hai, độc lập với MuPDF
const require = createRequire(import.meta.url);
const pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
const pdfjs = await import(pathToFileURL(path.join(pdfjsDir, 'legacy/build/pdf.mjs')).href);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(pdfjsDir, 'legacy/build/pdf.worker.mjs')).href;
async function pdfjsText(buf) {
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, verbosity: 0, standardFontDataUrl: pathToFileURL(path.join(pdfjsDir, 'standard_fonts/')).href });
  const doc = await task.promise;
  const p = await doc.getPage(1); const tc = await p.getTextContent();
  const t = tc.items.map((i) => i.str + (i.hasEOL ? '\n' : '')).join('');
  await task.destroy(); return t;
}

function render(doc) {
  const pm = doc.loadPage(0).toPixmap([SCALE, 0, 0, SCALE, 0, 0], mupdf.ColorSpace.DeviceRGB, false, true);
  // chép điểm ảnh ra khỏi bộ nhớ WASM ngay, vì vùng nhớ có thể bị dùng lại sau các thao tác tiếp theo
  return { w: pm.getWidth(), h: pm.getHeight(), x: pm.getX(), y: pm.getY(), stride: pm.getStride(), px: pm.getPixels().slice() };
}
function diffOutside(a, b, rect) {
  // rect: vùng sửa (đơn vị trang). Đếm điểm ảnh khác biệt rõ rệt nằm ngoài vùng đó.
  const [x0, y0, x1, y1] = rect.map((v, i) => Math.round(v * SCALE) + (i < 2 ? -6 : 6));
  let n = 0;
  for (let y = 0; y < Math.min(a.h, b.h); y++) for (let x = 0; x < Math.min(a.w, b.w); x++) {
    const X = x + a.x, Y = y + a.y; if (X >= x0 && X <= x1 && Y >= y0 && Y <= y1) continue;
    const i = y * a.stride + x * 3, j = y * b.stride + x * 3;
    if (Math.abs(a.px[i] - b.px[j]) > 48 || Math.abs(a.px[i + 1] - b.px[j + 1]) > 48 || Math.abs(a.px[i + 2] - b.px[j + 2]) > 48) n++;
  }
  return n;
}
function crop(r, rect, file) {
  const pad = 8 * SCALE;
  const x0 = Math.max(r.x, Math.round(rect[0] * SCALE) - pad), y0 = Math.max(r.y, Math.round(rect[1] * SCALE) - pad);
  const x1 = Math.min(r.x + r.w, Math.round(rect[2] * SCALE) + pad), y1 = Math.min(r.y + r.h, Math.round(rect[3] * SCALE) + pad);
  const out = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [x0, y0, x1, y1], false);
  const op = out.getPixels(), os = out.getStride();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y - r.y) * r.stride + (x - r.x) * 3, j = (y - y0) * os + (x - x0) * 3;
    op[j] = r.px[i]; op[j + 1] = r.px[i + 1]; op[j + 2] = r.px[i + 2];
  }
  fs.writeFileSync(path.join(REPORT, file), out.asPNG());
}

const cases = JSON.parse(fs.readFileSync(path.join(SAMPLES, 'cases.json'), 'utf8'));
const results = [];
for (const [sid, s] of Object.entries(cases)) {
  const src = fs.readFileSync(path.join(SAMPLES, sid + '.pdf'));
  const docB = mupdf.Document.openDocument(src, 'application/pdf');
  const textB = pageText(docB.loadPage(0));
  const extractOk = s.expect.every((e) => NFC(textB).includes(NFC(e)));
  const missing = s.expect.filter((e) => !NFC(textB).includes(NFC(e)));
  for (const c of s.cases) {
    const r = { sample: sid, label: s.label, id: c.id, find: c.find, replace: c.replace, note: c.note, extractOk, missing, chars: textB.replace(/\s/g, '').length };
    try {
      const doc = mupdf.Document.openDocument(src, 'application/pdf').asPDF();
      const before = render(doc);
      const rep = replaceText(doc, 0, c.find, c.replace, { loadFont });
      Object.assign(r, rep);
      if (rep.status === 'ok') {
        const buf = doc.saveToBuffer('garbage=compact,compress=yes').asUint8Array().slice();
        fs.writeFileSync(path.join(OUTPDF, `${sid}-${c.id}.pdf`), buf);
        const doc2 = mupdf.Document.openDocument(buf, 'application/pdf');
        const textA = pageText(doc2.loadPage(0));
        // không tính chỗ chữ cũ nằm bên trong chữ mới (vd. “Facebook” trong “Facebook Ads”)
        r.oldRemoved = count(NFC(textA).split(NFC(c.replace)).join('\u0000'), c.find) === count(NFC(textB).split(NFC(c.replace)).join('\u0000'), c.find) - 1;
        r.newMupdf = NFC(textA).includes(NFC(c.replace));
        const tj = await pdfjsText(buf);
        r.newPdfjs = NFC(tj).replace(/\s+/g, ' ').includes(NFC(c.replace));
        const after = render(doc2);
        r.outsidePixels = diffOutside(before, after, rep.region);
        const box = [Math.min(rep.region[0], rep.lineBox[0]), rep.region[1], Math.max(rep.region[2], rep.lineBox[2]), rep.region[3]];
        crop(before, box, `${sid}-${c.id}-before.png`);
        crop(after, box, `${sid}-${c.id}-after.png`);
      }
    } catch (e) { r.status = 'error'; r.error = String(e && e.message || e); }
    r.pass = r.status === 'ok' && r.extractOk && r.oldRemoved && r.newMupdf && r.newPdfjs && r.outsidePixels === 0 && !r.overflow;
    results.push(r);
    console.log(`${r.pass ? 'ĐẠT ' : 'CHƯA'} ${sid}/${c.id} ${r.status} ${r.strategy || ''} tz=${r.tz ?? '-'} outside=${r.outsidePixels ?? '-'} ${r.error || r.reason || ''}`);
  }
}
fs.writeFileSync(path.join(REPORT, 'results.json'), JSON.stringify(results, null, 2));

// ---------- REPORT.md ----------
const yes = (b) => (b ? '✅' : '❌');
const STRAT = { 'A-original': 'Dùng lại phông gốc', 'B-same-family': 'Phông cùng họ', 'C-width-match': 'Phông khớp độ rộng', 'C-generic': 'Phông dự phòng chung' };
const mupdfVer = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/mupdf/package.json'), 'utf8')).version;
let md = `# Báo cáo thử chất lượng sửa chữ gốc (MuPDF.js ${mupdfVer})\n\n`;
md += `Sinh tự động bởi \`node spike/run.mjs\` lúc ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Bộ mẫu: PDF tiếng Việt do Chromium xuất (phông nhúng dạng tập con như Word/Google Docs/Canva). Đây là **mẫu tổng hợp**: chứng minh cơ chế, chưa thay được bộ PDF thật.\n\n`;
const pass = results.filter((r) => r.pass).length;
md += `**Kết quả: ${pass}/${results.length} ca đạt** đủ cả 6 tiêu chí.\n\n`;
md += `| Mẫu | Ca | Sửa | Đọc chữ gốc đúng | Phông dùng | Chữ cũ bị xoá | Chữ mới đọc được (MuPDF / pdf.js) | Co ngang | Điểm ảnh đổi ngoài vùng sửa | Kết quả |\n|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of results) {
  const fontCell = r.status === 'ok' ? `${STRAT[r.strategy]}${r.fallback ? ` (${r.fallback.replace(/\.(ttf|otf)$/, '')}${r.match ? `, lệch ${r.match.perChar}%/ký tự` : ''})` : ''}; gốc: ${r.fontName}` : (r.status === 'not-found' ? 'không tìm thấy chữ' : r.status === 'no-font' ? `thiếu phông (${r.fontName})` : r.error || r.status);
  md += `| ${r.sample} | ${r.id} | “${r.find}” → “${r.replace}” | ${yes(r.extractOk)} | ${fontCell} | ${r.status === 'ok' ? yes(r.oldRemoved) : '—'} | ${r.status === 'ok' ? `${yes(r.newMupdf)} / ${yes(r.newPdfjs)}` : '—'} | ${r.status === 'ok' ? (r.overflow ? `❌ tràn (cần ${Math.round(r.avail / r.width * 100)}%)` : r.tz === 100 ? 'không' : r.tz + '%') : '—'} | ${r.status === 'ok' ? r.outsidePixels : '—'} | ${r.pass ? '✅ Đạt' : '❌ Chưa'} |\n`;
}
md += `\nTiêu chí đạt: đọc đúng chữ có dấu trong file gốc; chữ cũ bị xoá khỏi lớp chữ; chữ mới đọc được bằng cả MuPDF và pdf.js; không có điểm ảnh nào đổi ngoài vùng sửa (bố cục giữ nguyên); không tràn quá mức co ngang 85%. **Độ giống phông bằng mắt** cần người xem ảnh bên dưới.\n\n## Ảnh trước / sau\n\n`;
for (const r of results) {
  md += `### ${r.sample} · ${r.id}: ${r.note}\n\n${r.label}. “${r.find}” → “${r.replace}”.\n\n`;
  if (r.status === 'ok') md += `| Trước | Sau |\n|---|---|\n| ![](${r.sample}-${r.id}-before.png) | ![](${r.sample}-${r.id}-after.png) |\n\n`;
  else md += `Không sửa được: ${r.status === 'not-found' ? (r.chars === 0 ? 'file không có lớp chữ (bản scan), cần nhận dạng chữ (OCR) trước.' : 'không tìm thấy cụm chữ trên một dòng.') : r.error || r.status}\n\n`;
}
fs.writeFileSync(path.join(REPORT, 'REPORT.md'), md);
console.log(`\n${pass}/${results.length} ca đạt → spike/report/REPORT.md`);
