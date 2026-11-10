// Lõi sửa chữ gốc trong PDF bằng MuPDF.js. Chạy được cả trong Node (bộ thử) lẫn trình duyệt (ứng dụng sau này).
// Core in-place PDF text editing with MuPDF.js. Runs in Node (spike) and in the browser (future app).
//
// Một lần sửa trên MỘT dòng:
//  1. Đọc từng ký tự của trang: vị trí gốc, phông, cỡ, màu, khung.
//  2. Nhận dạng "kiểu chữ" của từng phông trên cả trang (analyzePage): phông có tên quen thuộc → phông cùng họ
//     đo bằng; phông lạ hoặc Type3 không tên → so độ rộng ký tự đo được trên trang để chọn phông + độ đậm khớp nhất.
//  3. Dựng lại chuỗi chữ từ chỗ sửa tới cuối dòng, giữ kiểu chữ theo từng ký tự: phần giống nhau ở đầu/cuối cụm
//     giữ kiểu gốc, phần mới lấy kiểu của ký tự gốc mà nó thay thế, đuôi dòng giữ kiểu gốc (dòng trộn thường/đậm vẫn đúng).
//  4. Xoá thật các ký tự cũ bằng redaction (không vẽ ô, không đụng ảnh và nét vẽ).
//  5. Mỗi đoạn cùng phông/cỡ/màu viết bằng một lệnh Tj; dùng lại phông nhúng gốc nếu nó có đủ ký tự, nếu không
//     dùng phông dự phòng đã nhận dạng. Chữ mới rộng hơn khoảng trống thì co ngang (Tz) tối đa 85%, quá thì báo tràn.
import * as mupdf from 'mupdf';

const NFC = (s) => String(s).normalize('NFC');
export const PT = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const baseName = (font) => String(font.getName() || '').replace(/^[A-Z]{6}\+/, '');
const keyOf = (font) => String(font.getName() || '');
const isType3 = (font) => /^Type3/.test(baseName(font));

/** Đọc các dòng chữ của trang kèm thông tin từng ký tự. */
export function readLines(page) {
  const st = page.toStructuredText('preserve-whitespace');
  const lines = []; let block = null, cur = null;
  st.walk({
    beginTextBlock(bbox) { block = bbox; },
    beginLine(bbox) { cur = { bbox, block, chars: [] }; },
    onChar(c, origin, font, size, quad, color) { cur.chars.push({ c, origin, font, size, quad, color, key: keyOf(font) }); },
    endLine() { if (cur && cur.chars.length) { cur.text = cur.chars.map((x) => x.c).join(''); lines.push(cur); } cur = null; },
  });
  return { st, lines };
}
export const pageText = (page) => readLines(page).lines.map((l) => l.text).join('\n');

/** Toàn bộ phông dự phòng trong fonts/ (đều đủ dấu tiếng Việt). */
export const FONT_FILES = [
  'LiberationSerif-Regular.ttf', 'LiberationSerif-Bold.ttf', 'LiberationSerif-Italic.ttf', 'LiberationSerif-BoldItalic.ttf',
  'LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf', 'LiberationSans-Italic.ttf', 'LiberationSans-BoldItalic.ttf',
  'Carlito-Regular.ttf', 'Carlito-Bold.ttf', 'Carlito-Italic.ttf', 'Carlito-BoldItalic.ttf',
  'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf',
  'Inter-Regular.otf', 'Inter-Medium.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf',
];
const fontCache = new Map();
function loadFallback(file, opts) {
  if (!fontCache.has(file)) fontCache.set(file, new mupdf.Font(file.replace(/\.(ttf|otf)$/, ''), opts.loadFont(file)));
  return fontCache.get(file);
}
const gid = (f, ch) => f.encodeCharacter(ch.codePointAt(0));
const covers = (font, text) => [...text].every((ch) => /\s/.test(ch) || gid(font, ch) > 0);

/** Họ phông dự phòng theo tên phông gốc. kind: 'same' (cùng họ/đo bằng) | 'generic'. */
export function fallbackFor(font) {
  const n = baseName(font).toLowerCase();
  const bold = font.isBold() || /bold|black|heavy/.test(n);
  const semi = /semibold|demibold|demi/.test(n), medium = /medium/.test(n);
  const italic = font.isItalic() || /italic|oblique/.test(n);
  const sfx = bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular';
  if (/liberationserif|times|tinos/.test(n)) return { file: `LiberationSerif-${sfx}.ttf`, kind: 'same' };
  if (/liberationsans|arial|helvetica|arimo/.test(n)) return { file: `LiberationSans-${sfx}.ttf`, kind: 'same' };
  if (/carlito|calibri/.test(n)) return { file: `Carlito-${sfx}.ttf`, kind: 'same' };
  if (/^inter\b|^inter-|^inter$|interdisplay/.test(n)) return { file: semi ? 'Inter-SemiBold.otf' : medium ? 'Inter-Medium.otf' : bold ? 'Inter-Bold.otf' : 'Inter-Regular.otf', kind: 'same' };
  if (/dejavusans/.test(n)) return { file: bold ? 'DejaVuSans-Bold.ttf' : 'DejaVuSans.ttf', kind: 'same' };
  if (/dejavuserif/.test(n)) return { file: bold ? 'DejaVuSerif-Bold.ttf' : 'DejaVuSerif.ttf', kind: 'same' };
  // Cambria/Caladea: Caladea thiếu dấu tiếng Việt nên dùng Liberation Serif.
  const serif = font.isSerif() || /serif|roman|cambria|georgia|garamond|minion|book|caladea/.test(n);
  return { file: serif ? `LiberationSerif-${sfx}.ttf` : `LiberationSans-${sfx}.ttf`, kind: 'generic' };
}

/** Cặp ký tự liền nhau trong cùng từ: khoảng cách gốc-tới-gốc thật = độ rộng ký tự đầu (không tính dấu cách vì căn đều làm giãn). */
function pairsOf(lines) {
  const by = new Map();
  for (const l of lines) for (let i = 0; i + 1 < l.chars.length; i++) {
    const a = l.chars[i], b = l.chars[i + 1];
    if (/\s/.test(a.c) || /\s/.test(b.c) || Math.abs(b.size - a.size) > 0.01) continue;
    const d = b.origin[0] - a.origin[0];
    if (d <= 0) continue;
    if (!by.has(a.key)) by.set(a.key, []);
    by.get(a.key).push({ ch: a.c, d, size: a.size });
  }
  return by;
}
/** Họ phông dự phòng và các độ đậm (chữ đứng) của từng họ. */
const FAMILIES = {
  Inter: ['Inter-Regular.otf', 'Inter-Medium.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf'],
  LiberationSans: ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf'],
  LiberationSerif: ['LiberationSerif-Regular.ttf', 'LiberationSerif-Bold.ttf'],
  Carlito: ['Carlito-Regular.ttf', 'Carlito-Bold.ttf'],
  DejaVuSans: ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'],
  DejaVuSerif: ['DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf'],
};
/** Sai số độ rộng của một phông so với các cặp đo được (càng nhỏ càng khớp). */
function widthScore(pairs, file, opts) {
  const f = loadFallback(file, opts);
  const ok = pairs.filter((p) => gid(f, p.ch) > 0);
  if (!ok.length || ok.length < pairs.length * 0.9) return null;
  const pred = ok.reduce((t, p) => t + f.advanceGlyph(gid(f, p.ch), 0) * p.size, 0);
  const act = ok.reduce((t, p) => t + p.d, 0);
  const perChar = ok.reduce((t, p) => t + Math.abs(f.advanceGlyph(gid(f, p.ch), 0) * p.size - p.d) / p.d, 0) / ok.length;
  const err = Math.abs(pred - act) / act;
  return { file, err, perChar, score: err + perChar, n: ok.length };
}

// ---- so "lượng mực": vẽ lại đúng các ký tự gốc bằng phông ứng viên tại đúng vị trí, so điểm ảnh tối ----
const INK_SCALE = 2;
function grayRender(page) {
  const pm = page.toPixmap([INK_SCALE, 0, 0, INK_SCALE, 0, 0], mupdf.ColorSpace.DeviceGray, false, true);
  return { px: pm.getPixels().slice(), w: pm.getWidth(), h: pm.getHeight(), x: pm.getX(), y: pm.getY(), stride: pm.getStride() };
}
const lum = (c) => (!c || !c.length ? 0 : c.length === 1 ? c[0] : c.length === 4 ? (1 - c[3]) * (1 - (c[0] + c[1] + c[2]) / 3) : 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
function inkOf(r, chars, textLum) {
  let total = 0;
  for (const c of chars) {
    const xs = [c.quad[0], c.quad[2], c.quad[4], c.quad[6]], ys = [c.quad[1], c.quad[3], c.quad[5], c.quad[7]];
    const x0 = Math.max(r.x, Math.floor(Math.min(...xs) * INK_SCALE) - 1), x1 = Math.min(r.x + r.w, Math.ceil(Math.max(...xs) * INK_SCALE) + 1);
    const y0 = Math.max(r.y, Math.floor(Math.min(...ys) * INK_SCALE) - 1), y1 = Math.min(r.y + r.h, Math.ceil(Math.max(...ys) * INK_SCALE) + 1);
    // nền = điểm ảnh khác màu chữ nhất trong ô (chữ tối trên nền sáng hoặc chữ sáng trên nền tối đều đúng)
    let mn = 255, mx = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = r.px[(y - r.y) * r.stride + (x - r.x)]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const t = (textLum ?? lum(c.color)) * 255, bg = Math.abs(mx - t) >= Math.abs(mn - t) ? mx : mn, span = bg - t;
    if (Math.abs(span) < 30) continue;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) total += Math.min(1, Math.max(0, (bg - r.px[(y - r.y) * r.stride + (x - r.x)]) / span));
  }
  return total;
}
function inkWith(file, chars, bounds, opts) {
  const f = loadFallback(file, opts);
  const tmp = new mupdf.PDFDocument();
  const fd = tmp.newDictionary(); fd.put('F', tmp.addFont(f));
  const res = tmp.newDictionary(); res.put('Font', fd);
  const H = bounds[3] - bounds[1];
  let content = '';
  for (const c of chars) {
    const g = gid(f, c.c); if (!g) return null;
    content += `BT /F ${+c.size.toFixed(3)} Tf 1 0 0 1 ${(c.origin[0] - bounds[0]).toFixed(3)} ${(H - (c.origin[1] - bounds[1])).toFixed(3)} Tm <${g.toString(16).padStart(4, '0')}> Tj ET\n`;
  }
  tmp.insertPage(-1, tmp.addPage([0, 0, bounds[2] - bounds[0], H], 0, res, content));
  const r = grayRender(tmp.loadPage(0));
  const shifted = chars.map((c) => ({ ...c, quad: c.quad.map((v, i) => v - (i % 2 ? bounds[1] : bounds[0])) }));
  return inkOf(r, shifted, 0);
}

/**
 * Nhận dạng kiểu chữ cho các phông trên trang. Trả về Map(key → { orig, file, kind, match, ink }).
 *  - Phông có tên quen thuộc (Times, Arial, Calibri, Inter…) → phông cùng họ đo bằng (kind 'same').
 *  - Phông lạ / Type3 không tên: chốt MỘT họ cho cả trang bằng độ rộng ký tự gộp từ mọi phông lạ,
 *    rồi chọn độ đậm cho từng phông bằng lượng mực (kind 'matched'); phông quá ít ký tự mượn độ đậm của ký tự kề (kind 'borrowed').
 */
export function analyzePage(page, lines, opts, needed) {
  const fonts = new Map(), charsBy = new Map();
  for (const l of lines) for (const c of l.chars) {
    if (!fonts.has(c.key)) fonts.set(c.key, c.font);
    if (!/\s/.test(c.c)) { if (!charsBy.has(c.key)) charsBy.set(c.key, []); charsBy.get(c.key).push(c); }
  }
  const pairs = pairsOf(lines);
  const styles = new Map(), unknown = [];
  for (const [key, font] of fonts) {
    const fb = isType3(font) ? { kind: 'generic' } : fallbackFor(font);
    if (fb.kind === 'same') styles.set(key, { orig: font, file: fb.file, kind: 'same' });
    else unknown.push(key);
  }
  if (!unknown.length) return styles;

  // 1) họ phông chung cho cả trang
  let family = null, famScore = Infinity, famDetail = null;
  for (const [fam, files] of Object.entries(FAMILIES)) {
    let sum = 0, n = 0, pc = 0;
    for (const k of unknown) {
      const p = pairs.get(k); if (!p || p.length < 3) continue;
      const best = files.map((f) => widthScore(p, f, opts)).filter(Boolean).sort((a, b) => a.score - b.score)[0];
      if (!best) continue;
      sum += best.score * p.length; pc += best.perChar * p.length; n += p.length;
    }
    if (n && sum / n < famScore) { famScore = sum / n; family = fam; famDetail = { perChar: +(pc / n * 100).toFixed(1), n }; }
  }
  if (!family) family = 'LiberationSans';
  const weights = FAMILIES[family];

  // 2) độ đậm cho từng phông cần dùng, theo lượng mực
  let gray = null;
  const bounds = page.getBounds();
  const decide = (key) => {
    if (styles.has(key)) return styles.get(key);
    const chars = (charsBy.get(key) || []).slice(0, 40);
    if (chars.length >= 4) {
      gray = gray || grayRender(page);
      const orig = inkOf(gray, chars);
      let best = null;
      for (const f of weights) {
        const cand = inkWith(f, chars, bounds, opts); if (cand == null) continue;
        const err = Math.abs(cand - orig) / Math.max(1, orig);
        if (!best || err < best.err) best = { file: f, err };
      }
      if (best) { const st = { orig: fonts.get(key), file: best.file, kind: 'matched', match: { family, perChar: famDetail && famDetail.perChar, ink: +(best.err * 100).toFixed(1) } }; styles.set(key, st); return st; }
    }
    return null;
  };
  for (const key of unknown) {
    if (needed && !needed.has(key)) continue;
    if (decide(key)) continue;
    // mượn độ đậm của ký tự gần nhất bên trái/phải trên cùng dòng (bỏ qua dấu cách), cùng cỡ, có đủ mẫu để đo
    const votes = new Map();
    for (const l of lines) l.chars.forEach((c, i) => {
      if (c.key !== key || /\s/.test(c.c)) return;
      for (const dir of [-1, 1]) {
        for (let j = i + dir; j >= 0 && j < l.chars.length; j += dir) {
          const n = l.chars[j];
          if (/\s/.test(n.c) || n.key === key) continue;
          if (Math.abs(n.size - c.size) > 0.01) break;
          const st = unknown.includes(n.key) ? decide(n.key) : styles.get(n.key);
          if (st) { votes.set(st.file, (votes.get(st.file) || 0) + 1); break; }
        }
      }
    });
    const v = [...votes].sort((a, b) => b[1] - a[1])[0];
    styles.set(key, { orig: fonts.get(key), file: v ? v[0] : weights[0], kind: v ? 'borrowed' : 'generic', match: { family } });
  }
  return styles;
}

/** Kiểu căn của dòng: 'center' | 'right' | 'left'. Dòng bắt đầu ở mép trái dùng chung với ≥2 dòng khác coi là căn trái
 *  (kể cả căn đều); còn lại xét tâm dòng so với tâm vùng nội dung, và mép phải so với lề phải. */
function alignmentOf(lines, line) {
  const others = lines.filter((l) => l !== line && Math.abs(l.bbox[3] - l.bbox[1] - (line.bbox[3] - line.bbox[1])) < 20);
  const sharedLeft = others.filter((l) => Math.abs(l.bbox[0] - line.bbox[0]) < 1.5).length;
  if (sharedLeft >= 2) return 'left';
  const left = Math.min(...lines.map((l) => l.bbox[0])), right = Math.max(...lines.map((l) => l.bbox[2]));
  if (line.bbox[0] - left < 2) return 'left'; // chạm lề trái: dòng thường hoặc căn đều
  const center = (line.bbox[0] + line.bbox[2]) / 2;
  if (Math.abs(center - (left + right) / 2) < 3) return 'center';
  if (Math.abs(line.bbox[2] - right) < 2 && line.bbox[0] > left + 40) return 'right';
  return 'left';
}

/** Biên phải khả dụng: tới chữ gần nhất phía bên phải (cột/ô bảng kế bên) trong dải ±3 dòng; không có thì lề phải nội dung. */
function rightLimit(lines, line, x) {
  const [, y0, , y1] = line.bbox, h = y1 - y0;
  let lim = Math.max(...lines.map((l) => l.bbox[2]));
  for (const l of lines) {
    if (l === line || l.bbox[0] <= line.bbox[2] - 1) continue;
    const gap = Math.max(0, l.bbox[1] - y1, y0 - l.bbox[3]);
    if (gap < 3 * h) lim = Math.min(lim, l.bbox[0] - 4);
  }
  return Math.max(lim, line.bbox[2]);
}
function colorOp(c) {
  const f = (v) => (+v).toFixed(3);
  if (!c || !c.length) return '0 g';
  if (c.length === 1) return `${f(c[0])} g`;
  if (c.length === 4) return `${c.map(f).join(' ')} k`;
  return `${c.map(f).join(' ')} rg`;
}
function shrinkQuad(q, k = 0.25) {
  const [ulx, uly, urx, ury, llx, lly, lrx, lry] = q;
  const top = (a, b) => a + (b - a) * k, bot = (a, b) => b - (b - a) * k;
  return [ulx, top(uly, lly), urx, top(ury, lry), llx, bot(uly, lly), lrx, bot(ury, lry)];
}

/** CMap ToUnicode cho phông Identity-H: glyph id (2 byte) → chuỗi Unicode (UTF-16BE). */
function toUnicodeCMap(map) {
  const hex4 = (n) => n.toString(16).padStart(4, '0').toUpperCase();
  const u16 = (str) => { let h = ''; for (const ch of str) { const cp = ch.codePointAt(0); if (cp > 0xffff) { const v = cp - 0x10000; h += hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff)); } else h += hex4(cp); } return h; };
  const entries = [...map].map(([g, ch]) => `<${hex4(g)}> <${u16(ch)}>`);
  let body = '';
  for (let i = 0; i < entries.length; i += 100) { const part = entries.slice(i, i + 100); body += `${part.length} beginbfchar\n${part.join('\n')}\nendbfchar\n`; }
  return `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /LMEd-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${body}endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
}

/** Dựng chuỗi ký tự mới kèm "ký tự gốc mẫu" quyết định kiểu (phông/cỡ/màu) cho từng ký tự. */
function buildSequence(findChars, replace, tailChars) {
  const F = findChars, R = [...NFC(replace)];
  let p = 0; while (p < F.length && p < R.length && NFC(F[p].c) === R[p]) p++;
  let q = 0; while (q < F.length - p && q < R.length - p && NFC(F[F.length - 1 - q].c) === R[R.length - 1 - q]) q++;
  const mid = F[p] || F[p - 1] || F[0];
  const seq = [];
  R.forEach((ch, i) => seq.push({ ch, src: i < p ? F[i] : i >= R.length - q ? F[F.length - (R.length - i)] : mid }));
  for (const c of tailChars) seq.push({ ch: c.c, src: c });
  while (seq.length && /\s/.test(seq[seq.length - 1].ch)) seq.pop();
  return seq;
}

/**
 * Thay `find` bằng `replace` trên một trang. opts.loadFont(file) → dữ liệu phông dự phòng.
 * Trả về báo cáo; không ném lỗi khi không tìm thấy (status = 'not-found').
 */
export function replaceText(doc, pageIndex, find, replace, opts) {
  const page = doc.loadPage(pageIndex);
  const { lines } = readLines(page);
  const want = NFC(find);
  let line = null, s = -1;
  for (const l of lines) { const t = NFC(l.text); const i = t.indexOf(want); if (i >= 0 && t.length === l.text.length) { line = l; s = i; break; } }
  if (!line) return { status: 'not-found', reason: lines.some((l) => NFC(l.text).includes(want)) ? 'decomposed' : 'not-on-one-line' };
  const e = s + [...want].length;
  const needed = new Set(line.chars.map((c) => c.key));
  const styles = analyzePage(page, lines, opts, needed);

  // Dòng căn giữa/căn phải: viết lại CẢ dòng để đặt lại vị trí theo kiểu căn.
  const align = alignmentOf(lines, line);
  const start = align === 'left' ? s : 0;
  const seq = line.chars.slice(start, s).map((c) => ({ ch: c.c, src: c })).concat(buildSequence(line.chars.slice(s, e), replace, line.chars.slice(e)));
  const editChars = line.chars.slice(start);
  const first = line.chars[start];
  const oldRight = Math.max(...editChars.map((c) => Math.max(c.quad[2], c.quad[6])));

  // --- phông cho từng kiểu: dùng lại phông gốc (có tên, đủ ký tự) hoặc phông dự phòng đã nhận dạng ---
  const perKey = new Map();
  for (const it of seq) { const k = it.src.key; if (!perKey.has(k)) perKey.set(k, ''); perKey.set(k, perKey.get(k) + it.ch); }
  const choice = new Map();
  for (const [k, text] of perKey) {
    const st = styles.get(k);
    if (!isType3(st.orig) && covers(st.orig, text)) { choice.set(k, { font: st.orig, strategy: 'A-original', label: baseName(st.orig) }); continue; }
    const f = loadFallback(st.file, opts);
    if (!covers(f, text)) return { status: 'no-font', fontName: baseName(st.orig), fallback: st.file };
    const strategy = st.kind === 'same' ? 'B-same-family' : st.kind === 'matched' ? 'C-matched' : st.kind === 'borrowed' ? 'C-borrowed' : 'C-generic';
    choice.set(k, { font: f, strategy, label: st.file.replace(/\.(ttf|otf)$/, ''), match: st.match });
  }

  // --- gom thành các đoạn cùng phông/cỡ/màu, đo độ rộng ---
  const runs = [];
  for (const it of seq) {
    const ch = choice.get(it.src.key), col = colorOp(it.src.color), size = +it.src.size.toFixed(3);
    const g = gid(ch.font, it.ch);
    const last = runs[runs.length - 1];
    if (last && last.font === ch.font && last.size === size && last.col === col) { last.gids.push(g); last.chars.push(it.ch); }
    else runs.push({ font: ch.font, size, col, gids: [g], chars: [it.ch], strategy: ch.strategy, label: ch.label });
  }
  let width = 0;
  for (const r of runs) { r.width = r.gids.reduce((w, g) => w + r.font.advanceGlyph(g, 0), 0) * r.size; width += r.width; }
  let x = first.origin[0];
  const oldLeft = x, oldEnd = oldRight;
  let avail = rightLimit(lines, line, x) - x;
  if (align === 'center') avail = Math.max(avail, oldEnd - oldLeft + 2 * Math.min(oldLeft - Math.min(...lines.map((l) => l.bbox[0])), Math.max(...lines.map((l) => l.bbox[2])) - oldEnd));
  if (align === 'right') avail = oldEnd - Math.min(...lines.map((l) => l.bbox[0]));
  let tz = 100, overflow = false;
  if (width > avail) { tz = Math.floor((avail / width) * 100); if (tz < 85) { overflow = true; tz = 85; } }
  const shown = width * tz / 100;
  if (align === 'center') x = (oldLeft + oldEnd) / 2 - shown / 2;
  if (align === 'right') x = oldEnd - shown;

  // --- xoá thật chữ cũ (cụm + đuôi dòng) ---
  const annot = page.createAnnotation('Redact');
  annot.setQuadPoints(editChars.map((c) => shrinkQuad(c.quad)));
  page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);

  // --- vẽ chữ mới ---
  const inv = mupdf.Matrix.invert(page.getTransform());
  const lin = mupdf.Matrix.concat([1, 0, 0, -1, 0, 0], inv);
  const [px, py] = PT(inv, [x, first.origin[1]]);
  const Tm = [lin[0], lin[1], lin[2], lin[3], px, py].map((v) => +v.toFixed(4));
  const pageObj = page.getObject();
  let res = pageObj.get('Resources');
  if (!res || res.isNull()) { res = doc.newDictionary(); pageObj.put('Resources', res); }
  res = res.resolve();
  let fonts = res.get('Font');
  if (!fonts || fonts.isNull()) { fonts = doc.newDictionary(); res.put('Font', fonts); }
  fonts = fonts.resolve();
  const keys = new Map(); let n = 1;
  for (const r of runs) {
    if (keys.has(r.font)) continue;
    while (!fonts.get('LMEd' + n).isNull()) n++;
    const fo = doc.addFont(r.font);
    // Tự ghi ToUnicode theo đúng chữ người dùng gõ: bảng cmap của phông nhúng gốc có thể ánh xạ dấu cách thành U+00A0
    // (gặp ở PDF của Word và Canva), làm tìm kiếm/copy sai dù nhìn đúng.
    const map = new Map();
    for (const rr of runs) if (rr.font === r.font) rr.gids.forEach((g, i) => { if (!map.has(g)) map.set(g, rr.chars[i]); });
    fo.resolve().put('ToUnicode', doc.addStream(toUnicodeCMap(map), {}));
    fonts.put('LMEd' + n, fo); keys.set(r.font, 'LMEd' + n); n++;
  }
  let content = `q\nBT\n${tz !== 100 ? tz + ' Tz\n' : ''}${Tm.join(' ')} Tm\n`;
  for (const r of runs) content += `${r.col}\n/${keys.get(r.font)} ${r.size} Tf\n<${r.gids.map((g) => g.toString(16).padStart(4, '0')).join('')}> Tj\n`;
  content += 'ET\nQ\n';
  const old = pageObj.get('Contents');
  const arr = doc.newArray();
  arr.push(doc.addStream('q\n', {}));
  if (old.isArray()) old.forEach((v) => arr.push(v)); else if (!old.isNull()) arr.push(old);
  arr.push(doc.addStream('Q\n', {}));
  arr.push(doc.addStream(content, {}));
  pageObj.put('Contents', arr);

  const used = [...new Map(runs.map((r) => [r.label, r.strategy])).entries()];
  const rank = { 'C-generic': 4, 'C-borrowed': 3, 'C-matched': 2, 'B-same-family': 1, 'A-original': 0 };
  const worst = used.reduce((w, [, st]) => (rank[st] > rank[w] ? st : w), 'A-original');
  const m = [...choice.values()].find((c) => c.match);
  return {
    status: 'ok', strategy: worst, fonts: used.map(([l, st]) => `${l} (${st})`), fontName: baseName(first.font),
    fallback: used.map(([l]) => l).join(' + '), match: m ? m.match : null, runs: runs.length,
    size: +first.size.toFixed(2), width: +width.toFixed(1), oldWidth: +(oldRight - oldLeft).toFixed(1), avail: +avail.toFixed(1), tz, overflow,
    align, region: [Math.min(x, oldLeft), line.bbox[1], Math.max(oldRight, x + width * tz / 100), line.bbox[3]], lineBox: line.bbox,
    centerShift: +(((x + shown / 2) - (oldLeft + oldEnd) / 2)).toFixed(1), rightShift: +((x + shown) - oldEnd).toFixed(1),
  };
}
