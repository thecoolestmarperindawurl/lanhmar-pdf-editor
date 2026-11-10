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
// MuPDF được "tiêm" từ ngoài vào để cùng một file chạy được trong Node (import 'mupdf') và trong Web Worker
// (import '../vendor/mupdf/mupdf.js'), vì Worker không hiểu tên gói trần như 'mupdf'.
let mupdf = null;
export function useMupdf(m) { mupdf = m; }

const NFC = (s) => String(s).normalize('NFC');
export const PT = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const baseName = (font) => String(font.getName() || '').replace(/^[A-Z]{6}\+/, '');
const keyOf = (font) => String(font.getName() || '');
const isType3 = (font) => /^Type3/.test(baseName(font));

/** Đọc các dòng chữ thô của MuPDF (một "dòng" có thể chỉ là một mảnh của dòng nhìn thấy). */
function readRawLines(page) {
  const st = page.toStructuredText('preserve-whitespace');
  const lines = []; let block = null, cur = null;
  st.walk({
    beginTextBlock(bbox) { block = bbox; },
    beginLine(bbox) { cur = { bbox, block, chars: [] }; },
    onChar(c, origin, font, size, quad, color) { cur.chars.push({ c, origin, font, size, quad, color, key: keyOf(font) }); },
    endLine() { if (cur && cur.chars.length) lines.push(cur); cur = null; },
  });
  return { st, lines };
}

/** Đọc các dòng nhìn thấy: ghép các mảnh cùng đường chân chữ, nằm sát nhau (khoảng cách < 0,6 cỡ chữ),
 *  ví dụ phần đầu dòng gốc và phần vừa sửa được ghi thêm ở cuối luồng nội dung. Ô bảng, cột kế bên cách xa hơn nên không bị ghép. */
export function readLines(page) {
  const { st, lines: raw } = readRawLines(page);
  const base = (l) => l.chars[0].origin[1];
  const used = new Set(), out = [];
  const sorted = raw.map((l, i) => ({ l, i })).sort((a, b) => base(a.l) - base(b.l) || a.l.bbox[0] - b.l.bbox[0]);
  for (const { l, i } of sorted) {
    if (used.has(i)) continue;
    used.add(i);
    const group = [l];
    let grew = true;
    while (grew) {
      grew = false;
      for (const { l: m, i: j } of sorted) {
        if (used.has(j)) continue;
        const size = Math.max(...group.flatMap((g) => g.chars.map((c) => c.size)), ...m.chars.map((c) => c.size));
        if (Math.abs(base(m) - base(group[0])) > size * 0.25) continue;
        const x0 = Math.min(...group.map((g) => g.bbox[0])), x1 = Math.max(...group.map((g) => g.bbox[2]));
        const gap = Math.max(m.bbox[0] - x1, x0 - m.bbox[2]);
        // chỉ ghép mảnh nối tiếp nhau; mảnh chồng lên nhau (biểu tượng vẽ đè, chữ in đè) giữ riêng
        if (gap >= -1 && gap < size * 0.6) { group.push(m); used.add(j); grew = true; }
      }
    }
    const chars = group.flatMap((g) => g.chars).sort((a, b) => a.origin[0] - b.origin[0]);
    const bbox = [Math.min(...group.map((g) => g.bbox[0])), Math.min(...group.map((g) => g.bbox[1])), Math.max(...group.map((g) => g.bbox[2])), Math.max(...group.map((g) => g.bbox[3]))];
    out.push({ bbox, block: group[0].block, chars, text: chars.map((x) => x.c).join('') });
  }
  // thứ tự đọc: theo khối gốc của MuPDF (giữ cột), trong khối thì trên → dưới
  out.sort((a, b) => (a.block && b.block && (a.block[0] !== b.block[0] || a.block[1] !== b.block[1]) ? (a.block[1] - b.block[1]) || (a.block[0] - b.block[0]) : 0) || a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
  return { st, lines: out };
}

/** Dòng chữ của trang ở dạng gửi được qua postMessage (cho giao diện). */
export function lineInfo(page) {
  // chỉ số i khớp với editLine(): đếm trên các dòng có chữ
  return readLines(page).lines.filter((l) => l.text.trim()).map((l, i) => {
    const c = l.chars.find((x) => !/\s/.test(x.c)) || l.chars[0];
    return { i, text: l.text.replace(/\s+$/, ''), bbox: l.bbox, size: +c.size.toFixed(2), color: c.color, bold: !!c.font.isBold(), italic: !!c.font.isItalic(), serif: !!c.font.isSerif() || /times|serif|roman|georgia|cambria|garamond/i.test(c.font.getName()),
      // vị trí x của từng ký tự để đặt con trỏ đúng chỗ người dùng bấm
      xs: l.chars.map((x) => +x.origin[0].toFixed(1)) };
  });
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

/** Nét ngang mỏng trên trang (gạch chân, gạch ngang, nét viền mỏng): { bbox, color, kind: 'fill'|'stroke' }. */
function thinRules(page) {
  const out = [];
  const bounds = (path, ctm) => {
    const xs = [], ys = [];
    const add = (x, y) => { xs.push(ctm[0] * x + ctm[2] * y + ctm[4]); ys.push(ctm[1] * x + ctm[3] * y + ctm[5]); };
    path.walk({ moveTo: add, lineTo: add, curveTo: (a, b, c, d, e, f) => { add(a, b); add(c, d); add(e, f); }, closePath() {} });
    return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;
  };
  const keep = (b, color, kind, lw = 0) => {
    if (!b) return;
    const h = b[3] - b[1] + lw, w = b[2] - b[0];
    if (w > 3 && h > 0 && h < 2.5 && w > 4 * h) out.push({ bbox: [b[0], b[1] - lw / 2, b[2], b[3] + lw / 2], color: color.slice(), kind });
  };
  const dev = new mupdf.Device({
    fillPath(path, eo, ctm, cs, color) { keep(bounds(path, ctm), color, 'fill'); },
    strokePath(path, st, ctm, cs, color) { let lw = 1; try { lw = st.getLineWidth ? st.getLineWidth() * Math.hypot(ctm[0], ctm[1]) : 1; } catch { /* mặc định */ } keep(bounds(path, ctm), color, 'stroke', lw); },
  });
  page.run(dev, mupdf.Matrix.identity); dev.close();
  return out;
}

/** Gạch chân / gạch ngang thuộc dòng: nét mỏng chạy dọc phần chữ, ngay dưới chân chữ hoặc xuyên giữa thân chữ. */
function decorationsOf(page, line, fromX, toX) {
  const c = line.chars.find((x) => !/\s/.test(x.c)) || line.chars[0];
  const base = c.origin[1], size = c.size;
  const textX0 = Math.min(...line.chars.map((x) => x.quad[0])), textX1 = Math.max(...line.chars.map((x) => x.quad[2]));
  return thinRules(page).filter((r) => {
    const [x0, y0, x1, y1] = r.bbox, mid = (y0 + y1) / 2;
    const under = mid > base - 0.05 * size && mid < base + 0.35 * size && y0 < line.bbox[3] + 0.2 * size;
    const strike = mid > base - 0.45 * size && mid < base - 0.15 * size;
    if (!under && !strike) return false;
    if (x0 < textX0 - 3 || x1 > textX1 + 3) return false; // dài hơn chữ: viền bảng, đường kẻ chia mục
    return x1 > fromX + 1 && x0 < toX; // chạm phần được viết lại
  }).map((r) => ({ ...r, type: (r.bbox[1] + r.bbox[3]) / 2 > base - 0.05 * size ? 'underline' : 'strike' }));
}

/** Kiểu căn của dòng: 'center' | 'right' | 'left'. Dòng bắt đầu ở mép trái dùng chung với ≥2 dòng khác coi là căn trái
 *  (kể cả căn đều); còn lại xét tâm dòng so với tâm vùng nội dung, và mép phải so với lề phải. */
function alignmentOf(lines, line, pageWidth) {
  const others = lines.filter((l) => l !== line && Math.abs(l.bbox[3] - l.bbox[1] - (line.bbox[3] - line.bbox[1])) < 20);
  const sharedLeft = others.filter((l) => Math.abs(l.bbox[0] - line.bbox[0]) < 1.5).length;
  if (sharedLeft >= 2) return 'left';
  const left = Math.min(...lines.map((l) => l.bbox[0]));
  // lề phải: mép phải xa nhất của chữ, hoặc lề đối xứng với lề trái khi các dòng không chạy tới lề phải (căn trái, không căn đều)
  const right = Math.max(...lines.map((l) => l.bbox[2]), pageWidth ? pageWidth - left : 0);
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
 * Thay `find` bằng `replace` trên một trang (dùng cho bộ thử). opts.loadFont(file) → dữ liệu phông dự phòng.
 * Trả về báo cáo; không ném lỗi khi không tìm thấy (status = 'not-found').
 */
export function replaceText(doc, pageIndex, find, replace, opts) {
  const page = doc.loadPage(pageIndex);
  const { lines } = readLines(page);
  const want = NFC(find);
  let line = null, s = -1;
  for (const l of lines) { const t = NFC(l.text); const i = t.indexOf(want); if (i >= 0 && t.length === l.text.length) { line = l; s = i; break; } }
  if (!line) return { status: 'not-found', reason: lines.some((l) => NFC(l.text).includes(want)) ? 'decomposed' : 'not-on-one-line' };
  return editRange(doc, page, lines, line, s, s + [...want].length, replace, opts);
}

/**
 * Sửa cả một dòng (dùng cho giao diện): `lineIndex` là chỉ số trong lineInfo(); `newText` là nội dung mới của dòng.
 * Chỉ viết lại từ chỗ khác biệt đầu tiên; phần giống nhau ở đầu/cuối giữ nguyên kiểu chữ gốc.
 */
export function editLine(doc, pageIndex, lineIndex, newText, opts) {
  const page = doc.loadPage(pageIndex);
  const { lines } = readLines(page);
  const vis = lines.filter((l) => l.text.trim());
  const line = vis[lineIndex];
  if (!line) return { status: 'not-found', reason: 'bad-line' };
  const O = line.chars.map((c) => NFC(c.c)), N = [...NFC(newText)];
  const oLen = O.length - (line.text.match(/\s+$/) || [''])[0].length; // bỏ khoảng trắng cuối dòng
  let p = 0; while (p < oLen && p < N.length && O[p] === N[p]) p++;
  let q = 0; while (q < oLen - p && q < N.length - p && O[oLen - 1 - q] === N[N.length - 1 - q]) q++;
  if (p === oLen && p === N.length) return { status: 'unchanged' };
  let s = p, e = oLen - q, rep = N.slice(p, N.length - q).join('');
  // luôn thay ít nhất một ký tự gốc để có mẫu kiểu chữ và vị trí (trường hợp chỉ chèn thêm chữ)
  if (s === e) { if (s > 0) { s -= 1; rep = O[s] + rep; } else { e += 1; rep = rep + O[0]; } }
  return editRange(doc, page, lines, line, s, e, rep, opts);
}

/** Các dòng tiếp theo cùng đoạn với `line`: cùng cỡ chữ, cùng lề trái (cho phép dòng đầu thụt vào),
 *  khoảng cách dòng đều (±12%), cùng cột. Đoạn kết thúc ở khoảng cách lớn hơn, thụt lề khác, hoặc đổi cỡ chữ. */
function paragraphAfter(lines, line) {
  const base = (l) => (l.chars.find((c) => !/\s/.test(c.c)) || l.chars[0]).origin[1];
  const left = (l) => (l.chars.find((c) => !/\s/.test(c.c)) || l.chars[0]).origin[0];
  const sizeOf = (l) => (l.chars.find((c) => !/\s/.test(c.c)) || l.chars[0]).size;
  const size = sizeOf(line);
  const below = lines.filter((l) => l !== line && base(l) > base(line) + size * 0.5 && l.bbox[0] < line.bbox[2] && l.bbox[2] > line.bbox[0])
    .sort((a, b) => base(a) - base(b));
  const out = []; let prev = line, d0 = null, x0 = null;
  for (const l of below) {
    if (Math.abs(sizeOf(l) - size) > 0.6) break;
    const d = base(l) - base(prev);
    if (d0 == null) { if (d < size * 0.95 || d > size * 1.8) break; d0 = d; } else if (Math.abs(d - d0) > d0 * 0.12) break;
    const lx = left(l);
    if (x0 == null) { if (lx > left(line) + 2 || lx < left(line) - 40) break; x0 = lx; } else if (Math.abs(lx - x0) > 2) break;
    out.push(l); prev = l;
  }
  return { lines: out, spacing: d0 };
}

/** Các dòng phía trên cùng đoạn với `line` (đi ngược lên, cùng cỡ, cùng lề trái, khoảng dòng đều). */
function paragraphBefore(lines, line, spacingHint) {
  const base = (l) => (l.chars.find((c) => !/\s/.test(c.c)) || l.chars[0]).origin[1];
  const left = (l) => (l.chars.find((c) => !/\s/.test(c.c)) || l.chars[0]).origin[0];
  const sizeOf = (l) => (l.chars.find((c) => !/\s/.test(c.c)) || l.chars[0]).size;
  const size = sizeOf(line);
  const above = lines.filter((l) => l !== line && base(l) < base(line) - size * 0.5 && l.bbox[0] < line.bbox[2] && l.bbox[2] > line.bbox[0])
    .sort((a, b) => base(b) - base(a));
  const out = []; let prev = line, d0 = spacingHint || null;
  for (const l of above) {
    if (Math.abs(sizeOf(l) - size) > 0.6) break;
    const d = base(prev) - base(l);
    if (d0 == null) { if (d < size * 0.95 || d > size * 1.8) break; d0 = d; } else if (Math.abs(d - d0) > d0 * 0.12) break;
    if (Math.abs(left(l) - left(line)) > 2 && out.length) break; // dòng đầu đoạn có thể thụt vào: nhận rồi dừng
    out.push(l); prev = l;
    if (Math.abs(left(l) - left(line)) > 2) break;
  }
  return out;
}

/** Lõi: thay các ký tự [s, e) của `line` bằng `replace`. Nếu dòng thuộc một đoạn căn trái và chữ mới không vừa
 *  (hoặc ngắn đi trong đoạn căn đều), dàn lại phần còn lại của đoạn: đẩy từ xuống / kéo từ lên các dòng có sẵn,
 *  thêm tối đa một dòng nếu ngay dưới đoạn còn trống; không được thì quay về cách co ngang một dòng. */
function editRange(doc, page, lines, line, s, e, replace, opts) {
  const pb = page.getBounds();
  const align = alignmentOf(lines, line, pb[2] - pb[0]);
  const para = align === 'left' ? paragraphAfter(lines, line) : { lines: [], spacing: null };
  const needed = new Set([line, ...para.lines].flatMap((l) => l.chars.map((c) => c.key)));
  const styles = analyzePage(page, lines, opts, needed);

  // Dòng căn giữa/căn phải: viết lại CẢ dòng để đặt lại vị trí theo kiểu căn.
  const start = align === 'left' && !opts._full ? s : 0;
  const lineSeq = line.chars.slice(start, s).map((c) => ({ ch: c.c, src: c })).concat(buildSequence(line.chars.slice(s, e), replace, line.chars.slice(e)));
  const first = line.chars[start];
  const editChars = line.chars.slice(start);
  const oldRight = Math.max(...editChars.map((c) => Math.max(c.quad[2], c.quad[6])));
  // chuỗi kéo dài tới hết đoạn (dùng khi dàn lại), nối các dòng bằng một dấu cách
  const paraSeq = lineSeq.slice();
  for (const l of para.lines) {
    const cs = l.chars.slice(); while (cs.length && /\s/.test(cs[cs.length - 1].c)) cs.pop();
    if (paraSeq.length && !/\s/.test(paraSeq[paraSeq.length - 1].ch)) paraSeq.push({ ch: ' ', src: paraSeq[paraSeq.length - 1].src });
    for (const c of cs) paraSeq.push({ ch: c.c, src: c });
  }

  // --- phông cho từng kiểu: dùng lại phông gốc (có tên, đủ ký tự) hoặc phông dự phòng đã nhận dạng ---
  const perKey = new Map();
  for (const it of paraSeq) { const k = it.src.key; if (!perKey.has(k)) perKey.set(k, ''); perKey.set(k, perKey.get(k) + it.ch); }
  const choice = new Map();
  for (const [k, text] of perKey) {
    const st = styles.get(k);
    if (!isType3(st.orig) && covers(st.orig, text)) { choice.set(k, { font: st.orig, strategy: 'A-original', label: baseName(st.orig) }); continue; }
    const f = loadFallback(st.file, opts);
    if (!covers(f, text)) return { status: 'no-font', fontName: baseName(st.orig), fallback: st.file };
    const strategy = st.kind === 'same' ? 'B-same-family' : st.kind === 'matched' ? 'C-matched' : st.kind === 'borrowed' ? 'C-borrowed' : 'C-generic';
    choice.set(k, { font: f, strategy, label: st.file.replace(/\.(ttf|otf)$/, ''), match: st.match });
  }
  const glyph = (it) => { const ch = choice.get(it.src.key); const g = gid(ch.font, it.ch); return { ch, g, w: ch.font.advanceGlyph(g, 0) * it.src.size }; };
  const widthOf = (items) => items.reduce((t, it) => t + glyph(it).w, 0);

  // --- đo một dòng ---
  const width = widthOf(lineSeq);
  let x = first.origin[0];
  const oldLeft = x, oldEnd = oldRight;
  const R = rightLimit(lines, line, x);
  let avail = R - x;
  if (align === 'center') avail = Math.max(avail, oldEnd - oldLeft + 2 * Math.min(oldLeft - Math.min(...lines.map((l) => l.bbox[0])), Math.max(...lines.map((l) => l.bbox[2])) - oldEnd));
  if (align === 'right') avail = oldEnd - Math.min(...lines.map((l) => l.bbox[0]));

  // --- gạch chân / gạch ngang của phần được viết lại (tìm trước khi xoá chữ) ---
  const decos = decorationsOf(page, line, oldLeft, oldEnd);

  // --- kế hoạch dàn lại đoạn ---
  let plan = null;
  if (align === 'left' && !decos.length) plan = planReflow({ lines, line, para, paraSeq, lineSeq, x, R, width, avail, pb, glyph, widthOf });
  // đoạn căn đều cần dàn lại: viết lại cả dòng từ đầu để khoảng cách từ đều nhau (chưa đụng gì vào trang nên làm lại được)
  if (plan && plan.justified && start > 0) return editRange(doc, page, lines, line, s, e, replace, { ...opts, _full: true });

  let tz = 100, overflow = false;
  if (!plan && width > avail) { tz = Math.floor((avail / width) * 100); if (tz < 85) { overflow = true; tz = 85; } }
  const shown = width * tz / 100;
  if (align === 'center') x = (oldLeft + oldEnd) / 2 - shown / 2;
  if (align === 'right') x = oldEnd - shown;
  const newEnd = x + shown;
  const mapDeco = (d) => {
    let [ux0, uy0, ux1, uy1] = d.bbox;
    if (align !== 'left') { ux0 = x + (ux0 - oldLeft); ux1 = newEnd - (oldEnd - ux1); }
    else { ux1 = ux1 >= oldEnd - 3 ? newEnd - (oldEnd - ux1) : ux1 + (newEnd - oldEnd); }
    return [ux0, uy0, Math.max(ux0 + 1, ux1), uy1];
  };

  // --- xoá thật chữ cũ: cụm + đuôi dòng (+ các dòng sau của đoạn khi dàn lại) ---
  const killChars = plan ? editChars.concat(...para.lines.map((l) => l.chars)) : editChars;
  const annot = page.createAnnotation('Redact');
  annot.setQuadPoints(killChars.map((c) => shrinkQuad(c.quad)));
  page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);
  // xoá nét trang trí cũ: lượt redaction riêng chỉ bỏ nét vẽ nằm gọn trong ô, không đụng chữ
  let decoDone = [];
  if (decos.length) {
    const before = thinRules(page).length;
    for (const d of decos) { const a2 = page.createAnnotation('Redact'); a2.setRect([d.bbox[0] - 0.4, d.bbox[1] - 0.4, d.bbox[2] + 0.4, d.bbox[3] + 0.4]); }
    page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_COVERED, mupdf.PDFPage.REDACT_TEXT_NONE);
    const removed = before - thinRules(page).length;
    if (removed >= decos.length) decoDone = decos; // chỉ vẽ lại khi chắc chắn nét cũ đã mất (tránh gạch đôi)
  }

  // --- các "mảnh" cần vẽ: [{ x, y, items }] (một mảnh = một từ khi dàn lại, cả dòng khi không) ---
  const pieces = plan ? plan.pieces : [{ x, y: first.origin[1], items: lineSeq }];

  // --- gom thành các đoạn cùng phông/cỡ/màu ---
  const allRuns = [];
  for (const pc of pieces) {
    pc.runs = [];
    for (const it of pc.items) {
      const { ch, g } = glyph(it); const col = colorOp(it.src.color), size = +it.src.size.toFixed(3);
      const last = pc.runs[pc.runs.length - 1];
      if (last && last.font === ch.font && last.size === size && last.col === col) { last.gids.push(g); last.chars.push(it.ch); }
      else { const r = { font: ch.font, size, col, gids: [g], chars: [it.ch], strategy: ch.strategy, label: ch.label }; pc.runs.push(r); allRuns.push(r); }
    }
  }

  // --- vẽ chữ mới ---
  const inv = mupdf.Matrix.invert(page.getTransform());
  const lin = mupdf.Matrix.concat([1, 0, 0, -1, 0, 0], inv);
  const pageObj = page.getObject();
  let res = pageObj.get('Resources');
  if (!res || res.isNull()) { res = doc.newDictionary(); pageObj.put('Resources', res); }
  res = res.resolve();
  let fonts = res.get('Font');
  if (!fonts || fonts.isNull()) { fonts = doc.newDictionary(); res.put('Font', fonts); }
  fonts = fonts.resolve();
  const keys = new Map(); let n = 1;
  for (const r of allRuns) {
    if (keys.has(r.font)) continue;
    while (!fonts.get('LMEd' + n).isNull()) n++;
    const fo = doc.addFont(r.font);
    // Tự ghi ToUnicode theo đúng chữ người dùng gõ: bảng cmap của phông nhúng gốc có thể ánh xạ dấu cách thành U+00A0
    // (gặp ở PDF của Word và Canva), làm tìm kiếm/copy sai dù nhìn đúng.
    const map = new Map();
    for (const rr of allRuns) if (rr.font === r.font) rr.gids.forEach((g, i) => { if (!map.has(g)) map.set(g, rr.chars[i]); });
    fo.resolve().put('ToUnicode', doc.addStream(toUnicodeCMap(map), {}));
    fonts.put('LMEd' + n, fo); keys.set(r.font, 'LMEd' + n); n++;
  }
  let content = '';
  for (const d of decoDone) {
    const [ux0, uy0, ux1, uy1] = mapDeco(d);
    const a3 = PT(inv, [ux0, uy0]), b3 = PT(inv, [ux1, uy1]);
    const rx = Math.min(a3[0], b3[0]), ry = Math.min(a3[1], b3[1]), rw = Math.abs(b3[0] - a3[0]), rh = Math.abs(b3[1] - a3[1]);
    content += `q\n${colorOp(d.color)}\n${[rx, ry, rw, rh].map((v) => +v.toFixed(3)).join(' ')} re f\nQ\n`;
  }
  content += `q\nBT\n${tz !== 100 ? tz + ' Tz\n' : ''}`;
  for (const pc of pieces) {
    const [px, py] = PT(inv, [pc.x, pc.y]);
    content += `${[lin[0], lin[1], lin[2], lin[3], px, py].map((v) => +v.toFixed(4)).join(' ')} Tm\n`;
    for (const r of pc.runs) content += `${r.col}\n/${keys.get(r.font)} ${r.size} Tf\n<${r.gids.map((g) => g.toString(16).padStart(4, '0')).join('')}> Tj\n`;
  }
  content += 'ET\nQ\n';
  const old = pageObj.get('Contents');
  const arr = doc.newArray();
  arr.push(doc.addStream('q\n', {}));
  if (old.isArray()) old.forEach((v) => arr.push(v)); else if (!old.isNull()) arr.push(old);
  arr.push(doc.addStream('Q\n', {}));
  arr.push(doc.addStream(content, {}));
  pageObj.put('Contents', arr);

  const used = [...new Map(allRuns.map((r) => [r.label, r.strategy])).entries()];
  const rank = { 'C-generic': 4, 'C-borrowed': 3, 'C-matched': 2, 'B-same-family': 1, 'A-original': 0 };
  const worst = used.reduce((w, [, st]) => (rank[st] > rank[w] ? st : w), 'A-original');
  const m = [...choice.values()].find((c) => c.match);
  const touched = plan ? [line, ...para.lines] : [line];
  const region = [
    Math.min(x, oldLeft, ...touched.map((l) => l.bbox[0]), ...decos.map((d) => d.bbox[0])),
    Math.min(...touched.map((l) => l.bbox[1]), ...decos.map((d) => d.bbox[1])),
    Math.max(oldRight, newEnd, ...(plan ? [R] : []), ...touched.map((l) => l.bbox[2]), ...decos.map((d) => d.bbox[2])),
    Math.max(...touched.map((l) => l.bbox[3]), ...decos.map((d) => d.bbox[3]), ...(plan && plan.added ? [plan.addedBottom] : [])),
  ];
  return {
    status: 'ok', strategy: worst, fonts: used.map(([l, st]) => `${l} (${st})`), fontName: baseName(first.font),
    fallback: used.map(([l]) => l).join(' + '), match: m ? m.match : null, runs: allRuns.length,
    size: +first.size.toFixed(2), width: +width.toFixed(1), oldWidth: +(oldRight - oldLeft).toFixed(1), avail: +avail.toFixed(1), tz, overflow,
    align, region, lineBox: line.bbox,
    centerShift: +(((x + shown / 2) - (oldLeft + oldEnd) / 2)).toFixed(1), rightShift: +((x + shown) - oldEnd).toFixed(1),
    decorations: decos.length ? { found: decos.map((d) => d.type), redrawn: decoDone.length } : null,
    reflow: plan ? { lines: plan.lineCount, was: 1 + para.lines.length, added: plan.added, justified: plan.justified } : null,
  };
}

/** Lập kế hoạch dàn lại đoạn. Trả về null nếu không cần (ngắt dòng như cũ và vừa chỗ) hoặc không làm được. */
function planReflow({ lines, line, para, paraSeq, lineSeq, x, R, width, avail, pb, glyph, widthOf }) {
  const first = line.chars.find((c) => !/\s/.test(c.c)) || line.chars[0];
  const size = first.size;
  // ô dòng có sẵn: dòng đang sửa (từ chỗ sửa) + các dòng sau của đoạn
  const slots = [{ x, y: line.chars[0].origin[1], right: R }];
  for (const l of para.lines) { const c = l.chars.find((cc) => !/\s/.test(cc.c)) || l.chars[0]; slots.push({ x: c.origin[0], y: c.origin[1], right: R }); }
  // đoạn căn đều: mọi dòng trừ dòng cuối chạm lề phải
  const all = [line, ...para.lines];
  // dấu cách trong dòng gốc có bị giãn không (dấu hiệu căn đều): khoảng cách thật so với độ rộng dấu cách tự nhiên
  const stretched = (l) => {
    let real = 0, nat = 0;
    for (let i = 0; i + 1 < l.chars.length; i++) {
      const c = l.chars[i]; if (!/\s/.test(c.c)) continue;
      const d = l.chars[i + 1].origin[0] - c.origin[0]; if (d <= 0) continue;
      real += d; nat += glyph({ ch: ' ', src: c }).w;
    }
    return nat > 0 && real / nat > 1.04; // đo trên mẫu: căn trái 0,99–1,01; căn đều ≥ 1,07
  };
  // xét cả các dòng phía trên trong cùng đoạn (chúng không phải dòng cuối) để biết đoạn có căn đều không
  const nonLast = paragraphBefore(lines, line, para.spacing).concat(all.slice(0, -1));
  const justified = nonLast.length >= 1 && nonLast.every((l) => R - l.bbox[2] < 3) && (nonLast.length >= 2 || stretched(nonLast[0]));
  const needLonger = width > avail + 0.5;
  const shorterInJustified = justified && para.lines.length && width < avail - size * 0.6;
  if (!needLonger && !shorterInJustified) return null;

  // tách từ
  const words = []; let cur = [];
  for (const it of paraSeq) { if (/\s/.test(it.ch)) { if (cur.length) { words.push({ items: cur, space: it }); cur = []; } } else cur.push(it); }
  if (cur.length) words.push({ items: cur, space: null });
  const W = words.map((w) => ({ ...w, w: widthOf(w.items), sw: w.space ? glyph(w.space).w : size * 0.25 }));

  const tryBreak = (slotList) => {
    const out = slotList.map(() => []); let si = 0, used = 0;
    for (const w of W) {
      for (;;) {
        if (si >= slotList.length) return null;
        const room = slotList[si].right - slotList[si].x;
        const need = (out[si].length ? out[si][out[si].length - 1].sw : 0) + w.w;
        if (used + need <= room + 0.5) { out[si].push(w); used += need; break; }
        if (!out[si].length) return null; // một từ dài hơn cả dòng
        si++; used = 0;
      }
    }
    return out.filter((o) => o.length);
  };
  let rows = tryBreak(slots), added = false, addedBottom = 0, useSlots = slots;
  if (!rows) {
    // thêm một dòng ngay dưới đoạn nếu chỗ đó trống
    const last = slots[slots.length - 1];
    const gap = para.spacing || size * 1.25;
    const ny = last.y + gap, nx = slots.length > 1 ? last.x : (line.chars.find((c) => !/\s/.test(c.c)) || line.chars[0]).origin[0];
    // dòng thêm phải cách nội dung bên dưới ít nhất ~nửa khoảng dòng, tránh dính sát đoạn sau
    const box = [nx, ny - size * 0.95, R, ny + Math.max(size * 0.3, gap * 0.6)];
    const busy = lines.some((l) => !all.includes(l) && l.bbox[0] < box[2] && l.bbox[2] > box[0] && l.bbox[1] < box[3] && l.bbox[3] > box[1]);
    if (busy || box[3] > pb[3] - 4) return null;
    useSlots = [...slots, { x: nx, y: ny, right: R }];
    rows = tryBreak(useSlots);
    if (!rows) return null;
    added = rows.length > slots.length; addedBottom = box[3];
  }
  // nếu cách ngắt dòng không đổi so với hiện tại thì không cần dàn lại
  const countWords = (items) => items.map((i) => i.ch).join('').split(/\s+/).filter(Boolean).length;
  const orig = [countWords(lineSeq), ...para.lines.map((l) => countWords(l.chars))];
  if (!needLonger && rows.length === orig.length && rows.every((r, i) => r.length === orig[i])) return null;

  const pieces = [];
  rows.forEach((row, ri) => {
    const sl = useSlots[ri];
    const lineW = row.reduce((t, w, i) => t + w.w + (i < row.length - 1 ? w.sw : 0), 0);
    const isLast = ri === rows.length - 1;
    let extra = 0;
    if (justified && !isLast && row.length > 1) { extra = (sl.right - sl.x - lineW) / (row.length - 1); if (extra > size * 1.2) extra = 0; }
    let cx = sl.x;
    row.forEach((w, i) => {
      const items = w.items.slice(); if (w.space && i < row.length - 1) items.push(w.space);
      pieces.push({ x: cx, y: sl.y, items });
      cx += w.w + (i < row.length - 1 ? w.sw + extra : 0);
    });
  });
  return { pieces, lineCount: rows.length, added, addedBottom, justified };
}
