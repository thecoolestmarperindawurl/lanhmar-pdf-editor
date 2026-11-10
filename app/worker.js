// Luồng nền: giữ tài liệu PDF và chạy MuPDF (WebAssembly) để giao diện không bị đứng.
// Background thread: owns the PDF document and runs MuPDF (WebAssembly) so the UI never freezes.
import * as mupdf from '../vendor/mupdf/mupdf.js';
import { useMupdf, lineInfo, editLine } from '../src/edit.mjs';

useMupdf(mupdf);

// Phông dự phòng nạp theo nhu cầu, đồng bộ (XHR đồng bộ được phép trong Worker), có bộ nhớ đệm.
const fontBytes = new Map();
function loadFont(file) {
  if (!fontBytes.has(file)) {
    const x = new XMLHttpRequest();
    x.open('GET', new URL('../fonts/' + file, import.meta.url).href, false);
    x.responseType = 'arraybuffer';
    x.send(null);
    if (x.status !== 200 && x.status !== 0) throw new Error('font ' + file + ': HTTP ' + x.status);
    fontBytes.set(file, new Uint8Array(x.response));
  }
  return fontBytes.get(file);
}

let doc = null;
const state = () => ({ canUndo: !!doc && doc.canUndo(), canRedo: !!doc && doc.canRedo() });

const handlers = {
  open(bytes) {
    if (doc) { try { doc.destroy(); } catch { /* ignore */ } doc = null; }
    const d = mupdf.Document.openDocument(new Uint8Array(bytes), 'application/pdf');
    if (d.needsPassword()) throw new Error('PASSWORD');
    const pdf = d.asPDF();
    if (!pdf) throw new Error('NOT_PDF');
    pdf.enableJournal();
    doc = pdf;
    const pages = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const b = doc.loadPage(i).getBounds();
      pages.push({ w: b[2] - b[0], h: b[3] - b[1] });
    }
    return { pages };
  },
  render(pi, scale) {
    const pm = doc.loadPage(pi).toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceRGB, true, true);
    const w = pm.getWidth(), h = pm.getHeight(), src = pm.getPixels(), stride = pm.getStride();
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) out.set(src.subarray(y * stride, y * stride + w * 4), y * w * 4);
    pm.destroy?.();
    return { w, h, data: out, $transfer: [out.buffer] };
  },
  lines(pi) {
    return lineInfo(doc.loadPage(pi));
  },
  edit(pi, li, text) {
    doc.beginOperation('edit');
    let rep;
    try {
      rep = editLine(doc, pi, li, text, { loadFont });
      if (rep.status === 'ok') doc.endOperation(); else doc.abandonOperation();
    } catch (e) { try { doc.abandonOperation(); } catch { /* ignore */ } throw e; }
    const keep = ['status', 'reason', 'strategy', 'fonts', 'tz', 'overflow', 'region', 'align', 'fontName', 'fallback'];
    return { rep: Object.fromEntries(keep.filter((k) => k in rep).map((k) => [k, rep[k]])), ...state() };
  },
  undo() { if (doc.canUndo()) doc.undo(); return state(); },
  redo() { if (doc.canRedo()) doc.redo(); return state(); },
  save() {
    // KHÔNG dọn rác trên tài liệu đang mở: garbage=compact đánh số lại đối tượng và làm hỏng các lần sửa sau.
    // Lưu bản sao thô → mở bản sao → cắt phông chỉ giữ ký tự dùng tới → dọn rác → trả về.
    const raw = doc.saveToBuffer('compress=yes').asUint8Array().slice();
    const copy = mupdf.Document.openDocument(raw, 'application/pdf').asPDF();
    try { copy.subsetFonts(); } catch { /* giữ nguyên phông nếu không cắt được */ }
    const out = copy.saveToBuffer('garbage=compact,compress=yes').asUint8Array().slice();
    copy.destroy?.();
    return { bytes: out, $transfer: [out.buffer] };
  },
};

self.onmessage = (ev) => {
  const { id, cmd, args } = ev.data;
  try {
    const result = handlers[cmd](...(args || []));
    const transfer = (result && result.$transfer) || [];
    if (result && result.$transfer) delete result.$transfer;
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};
self.postMessage({ ready: true });
