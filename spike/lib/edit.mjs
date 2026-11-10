// Lõi sửa chữ gốc trong PDF bằng MuPDF.js. Chạy được cả trong Node (bộ thử) lẫn trình duyệt (ứng dụng sau này).
// Core in-place PDF text editing with MuPDF.js. Runs in Node (spike) and in the browser (future app).
//
// Cách làm cho một lần sửa trên MỘT dòng:
//  1. Đọc từng ký tự của trang (structured text): vị trí gốc, phông, cỡ, màu, khung.
//  2. Tìm cụm cần sửa trong một dòng. Phần đuôi dòng từ cụm đó trở đi được viết lại cùng chữ mới,
//     để chữ dài/ngắn hơn không đè lên chữ phía sau.
//  3. Xoá thật các ký tự đó bằng redaction (không vẽ ô đen, không đụng ảnh và nét vẽ).
//  4. Chọn phông: (A) dùng lại phông nhúng gốc nếu có đủ ký tự; (B) phông "đo bằng" cùng họ
//     (Times→Liberation Serif, Arial→Liberation Sans, Calibri→Carlito); (C) phông chung có dấu tiếng Việt.
//  5. Nhúng phông (Type0/Identity-H, có ToUnicode) và vẽ chữ mới đúng gốc toạ độ, cỡ, màu.
//     Nếu chữ mới rộng hơn khoảng trống, co ngang (Tz) tối đa tới 85%; quá mức đó thì báo tràn.
import * as mupdf from 'mupdf';

const NFC = (s) => String(s).normalize('NFC');
export const PT = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/** Đọc các dòng chữ của trang kèm thông tin từng ký tự. */
export function readLines(page) {
  const st = page.toStructuredText('preserve-whitespace');
  const lines = []; let block = null, cur = null;
  st.walk({
    beginTextBlock(bbox) { block = bbox; },
    beginLine(bbox) { cur = { bbox, block, chars: [] }; },
    onChar(c, origin, font, size, quad, color) { cur.chars.push({ c, origin, font, size, quad, color }); },
    endLine() { if (cur && cur.chars.length) { cur.text = cur.chars.map((x) => x.c).join(''); lines.push(cur); } cur = null; },
  });
  return { st, lines };
}

export const pageText = (page) => readLines(page).lines.map((l) => l.text).join('\n');

const baseName = (font) => String(font.getName() || '').replace(/^[A-Z]{6}\+/, '');

/** Họ phông dự phòng theo tên phông gốc. kind: 'same' (cùng họ/đo bằng) | 'generic'. */
export function fallbackFor(font) {
  const n = baseName(font).toLowerCase();
  const bold = font.isBold() || /bold|black|heavy|semibold|demi/.test(n);
  const italic = font.isItalic() || /italic|oblique/.test(n);
  const sfx = bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular';
  if (/liberationserif|times|tinos/.test(n)) return { file: `LiberationSerif-${sfx}.ttf`, kind: 'same' };
  if (/liberationsans|arial|helvetica|arimo/.test(n)) return { file: `LiberationSans-${sfx}.ttf`, kind: 'same' };
  if (/carlito|calibri/.test(n)) return { file: `Carlito-${sfx}.ttf`, kind: 'same' };
  if (/^inter\b|inter-|interdisplay|^inter$/.test(n)) return { file: bold ? 'Inter-Bold.otf' : 'Inter-Regular.otf', kind: 'same' };
  if (/dejavusans/.test(n)) return { file: bold ? 'DejaVuSans-Bold.ttf' : 'DejaVuSans.ttf', kind: 'same' };
  if (/dejavuserif/.test(n)) return { file: bold ? 'DejaVuSerif-Bold.ttf' : 'DejaVuSerif.ttf', kind: 'same' };
  // Cambria/Caladea: Caladea thiếu dấu tiếng Việt nên dùng Liberation Serif.
  const serif = font.isSerif() || /serif|roman|cambria|georgia|garamond|minion|book|caladea/.test(n);
  return { file: serif ? `LiberationSerif-${sfx}.ttf` : `LiberationSans-${sfx}.ttf`, kind: 'generic' };
}

/** Toàn bộ phông dự phòng có trong thư mục fonts/ (đều đủ dấu tiếng Việt). */
export const FONT_FILES = [
  'LiberationSerif-Regular.ttf', 'LiberationSerif-Bold.ttf', 'LiberationSerif-Italic.ttf', 'LiberationSerif-BoldItalic.ttf',
  'LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf', 'LiberationSans-Italic.ttf', 'LiberationSans-BoldItalic.ttf',
  'Carlito-Regular.ttf', 'Carlito-Bold.ttf', 'Carlito-Italic.ttf', 'Carlito-BoldItalic.ttf',
  'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf',
  'Inter-Regular.otf', 'Inter-Bold.otf',
];
const fontCache = new Map();
function loadFallback(file, opts) {
  if (!fontCache.has(file)) fontCache.set(file, new mupdf.Font(file.replace(/\.(ttf|otf)$/, ''), opts.loadFont(file)));
  return fontCache.get(file);
}

/** Cặp ký tự liền nhau trong cùng từ, cùng phông với `font`: khoảng cách gốc-tới-gốc thật trên trang = độ rộng ký tự đầu.
 *  Không tính dấu cách (căn đều hai bên làm giãn dấu cách). */
function advancePairs(line, font) {
  // Chromium chia một phông thành nhiều phông Type3 (mỗi cái giữ vài ký tự) nên với Type3 gom mọi ký tự Type3 cùng cỡ.
  const t3 = /^Type3/.test(baseName(font));
  const same = (f) => f === font || baseName(f) === baseName(font) || (t3 && /^Type3/.test(baseName(f)));
  const out = [];
  for (let i = 0; i + 1 < line.chars.length; i++) {
    const a = line.chars[i], b = line.chars[i + 1];
    if (!same(a.font)) continue;
    if (/\s/.test(a.c) || /\s/.test(b.c) || Math.abs(b.size - a.size) > 0.01) continue;
    const d = b.origin[0] - a.origin[0];
    if (d > 0) out.push({ ch: a.c, d, size: a.size });
  }
  return out;
}
/** Chọn phông dự phòng có độ rộng ký tự khớp nhất với chữ gốc. Trả về { file, err } (err = sai số tương đối của tổng độ rộng). */
function matchByWidth(pairs, text, opts) {
  let best = null;
  const actual = pairs.reduce((t, p) => t + p.d, 0);
  for (const file of FONT_FILES) {
    const f = loadFallback(file, opts);
    if (!covers(f, text) || !pairs.every((p) => f.encodeCharacter(p.ch.codePointAt(0)) > 0)) continue;
    const pred = pairs.reduce((t, p) => t + f.advanceGlyph(f.encodeCharacter(p.ch.codePointAt(0)), 0) * p.size, 0);
    // sai số theo từng ký tự (bắt được khác biệt dáng chữ), cộng sai số tổng (bắt được khác biệt độ đậm)
    const perChar = pairs.reduce((t, p) => t + Math.abs(f.advanceGlyph(f.encodeCharacter(p.ch.codePointAt(0)), 0) * p.size - p.d) / p.d, 0) / pairs.length;
    const err = Math.abs(pred - actual) / actual;
    const score = err + perChar;
    if (!best || score < best.score) best = { file, err, perChar, score };
  }
  return best;
}

const covers = (font, text) => [...text].every((ch) => ch === ' ' || font.encodeCharacter(ch.codePointAt(0)) > 0);

/** Biên phải khả dụng cho chữ bắt đầu ở x trên dòng `line`: tới chữ gần nhất phía bên phải (cột kế bên, ô bảng kế bên)
 *  trong dải ±3 dòng theo chiều dọc; không có thì tới lề phải của nội dung trang. */
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
  // giữ phần giữa theo chiều cao để không chạm dòng trên/dưới
  const [ulx, uly, urx, ury, llx, lly, lrx, lry] = q;
  const top = (a, b) => a + (b - a) * k, bot = (a, b) => b - (b - a) * k;
  return [ulx, top(uly, lly), urx, top(ury, lry), llx, bot(uly, lly), lrx, bot(ury, lry)];
}

/**
 * Thay `find` bằng `replace` trên một trang.
 * opts.loadFont(file) → Uint8Array dữ liệu phông dự phòng.
 * Trả về báo cáo chi tiết; không ném lỗi khi không tìm thấy (status = 'not-found').
 */
export function replaceText(doc, pageIndex, find, replace, opts) {
  const page = doc.loadPage(pageIndex);
  const { lines } = readLines(page);
  const want = NFC(find);
  let line = null, s = -1;
  for (const l of lines) { const i = NFC(l.text).indexOf(want); if (i >= 0 && NFC(l.text).length === l.text.length) { line = l; s = i; break; } }
  if (!line) return { status: 'not-found', reason: lines.some((l) => NFC(l.text).includes(want)) ? 'decomposed' : 'not-on-one-line' };

  const e = s + [...want].length;
  const tailChars = line.chars.slice(e);
  const newRun = NFC(replace) + tailChars.map((c) => c.c).join('').replace(/\s+$/, '');
  const first = line.chars[s];
  const editChars = line.chars.slice(s);
  const oldRight = Math.max(...editChars.map((c) => Math.max(c.quad[2], c.quad[6])));

  // --- chọn phông ---
  let font = null, fontObj = null, strategy = '', fbFile = null;
  const orig = first.font;
  if (covers(orig, newRun)) {
    try { fontObj = doc.addFont(orig); font = orig; strategy = 'A-original'; } catch { font = null; fontObj = null; }
  }
  let match = null;
  if (!font) {
    const fb = fallbackFor(orig);
    let file = fb.file, kind = fb.kind;
    if (fb.kind !== 'same') {
      // Tên phông không cho biết họ (phông lạ, hoặc Type3 không còn tên): so độ rộng ký tự đo được trên trang.
      const pairs = advancePairs(line, orig);
      if (pairs.length >= 4) { match = matchByWidth(pairs, newRun, opts); if (match) { file = match.file; kind = 'matched'; } }
    }
    fbFile = file;
    const f = loadFallback(file, opts);
    if (!covers(f, newRun)) return { status: 'no-font', fontName: baseName(orig), fallback: file };
    font = f; fontObj = doc.addFont(f);
    strategy = kind === 'same' ? 'B-same-family' : kind === 'matched' ? 'C-width-match' : 'C-generic';
  }
  // --- đo chữ mới ---
  const gids = [...newRun].map((ch) => font.encodeCharacter(ch.codePointAt(0)));
  const width = gids.reduce((w, g) => w + font.advanceGlyph(g, 0), 0) * first.size;
  const x = first.origin[0];
  const avail = rightLimit(lines, line, x) - x;
  const oldWidth = oldRight - x;
  let tz = 100, overflow = false;
  if (width > avail) { tz = Math.floor((avail / width) * 100); if (tz < 85) { overflow = true; tz = 85; } }

  // --- xoá thật chữ cũ (cụm + đuôi dòng) ---
  const annot = page.createAnnotation('Redact');
  annot.setQuadPoints(editChars.map((c) => shrinkQuad(c.quad)));
  page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);

  // --- vẽ chữ mới ---
  const ctm = page.getTransform();
  const inv = mupdf.Matrix.invert(ctm);
  const lin = mupdf.Matrix.concat([1, 0, 0, -1, 0, 0], inv);
  const [px, py] = PT(inv, first.origin);
  const Tm = [lin[0], lin[1], lin[2], lin[3], px, py].map((v) => +v.toFixed(4));
  const pageObj = page.getObject();
  let res = pageObj.get('Resources');
  if (!res || res.isNull()) { res = doc.newDictionary(); pageObj.put('Resources', res); }
  res = res.resolve();
  let fonts = res.get('Font');
  if (!fonts || fonts.isNull()) { fonts = doc.newDictionary(); res.put('Font', fonts); }
  fonts = fonts.resolve();
  let key = 'LMEd1'; for (let k = 1; !fonts.get(key).isNull(); k++) key = 'LMEd' + k;
  fonts.put(key, fontObj);
  const hex = gids.map((g) => g.toString(16).padStart(4, '0')).join('');
  const content = `q\n${colorOp(first.color)}\nBT\n/${key} ${+first.size.toFixed(3)} Tf\n${tz !== 100 ? tz + ' Tz\n' : ''}${Tm.join(' ')} Tm\n<${hex}> Tj\nET\nQ\n`;
  const old = pageObj.get('Contents');
  const arr = doc.newArray();
  arr.push(doc.addStream('q\n', {}));
  if (old.isArray()) old.forEach((v) => arr.push(v)); else if (!old.isNull()) arr.push(old);
  arr.push(doc.addStream('Q\n', {}));
  arr.push(doc.addStream(content, {}));
  pageObj.put('Contents', arr);

  const lineH = line.bbox[3] - line.bbox[1];
  const region = [x, line.bbox[1], Math.max(oldRight, x + width * tz / 100), line.bbox[3]];
  return {
    status: 'ok', strategy, fontName: baseName(orig), fallback: fbFile, size: +first.size.toFixed(2),
    match: match ? { err: +(match.err * 100).toFixed(1), perChar: +(match.perChar * 100).toFixed(1) } : null,
    width: +width.toFixed(1), oldWidth: +oldWidth.toFixed(1), avail: +avail.toFixed(1), tz, overflow,
    region, lineBox: line.bbox, lineHeight: lineH, newRun,
  };
}
