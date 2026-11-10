import { driveEnabled, pickPdf, loadFile, saveCopy } from './drive.js';

// LANHMAR PDF Editor — giao diện: mở PDF, vẽ trang, bấm vào dòng để sửa, hoàn tác, tải về.
// UI: open a PDF, render pages, click a line to edit it, undo/redo, download.

// ---------- song ngữ / i18n ----------
const I18N = {
  vi: {
    kicker: '★ MIỄN PHÍ · CHẠY TRONG TRÌNH DUYỆT',
    h1: 'Sửa chữ trong PDF<br><em>như sửa văn bản</em>',
    lead: 'Bấm vào dòng chữ bất kỳ, gõ lại, nhấn Enter. Mình giữ nguyên phông, cỡ, màu và bố cục. File không rời máy bạn.',
    drop: 'Kéo thả file PDF vào đây',
    choose: 'Chọn file PDF', demo: 'Thử với file mẫu',
    privacy: '🔒 Xử lý ngay trên máy bạn bằng WebAssembly. Không tải file lên máy chủ nào, không cần tài khoản.',
    f1h: 'Giữ phông gốc', f1: 'Dùng lại phông trong file, hoặc phông cùng họ đủ dấu tiếng Việt khi phông gốc thiếu chữ.',
    f2h: 'Xoá thật chữ cũ', f2: 'Chữ cũ bị xoá khỏi file, không phải che ô trắng. Tìm kiếm và copy thấy đúng chữ mới.',
    f3h: 'Không xê dịch gì khác', f3: 'Chỉ đoạn bạn sửa thay đổi. Giữ căn giữa, căn phải, căn đều, chữ đậm, nghiêng, gạch chân; chữ dài ra tự dàn xuống dòng sau.',
    limH: 'Mình chưa làm được gì?',
    lim1: 'PDF bản scan hoặc ảnh chụp (không có lớp chữ).',
    lim2: 'Sửa nhiều dòng một lúc: hiện sửa từng dòng; chữ dài ra sẽ tự dàn xuống các dòng sau của đoạn.',
    lim3: 'Nếu đoạn không còn chỗ (đoạn sau nằm sát bên dưới), chữ được nén ngang tối đa 85%; dài hơn nữa nên rút gọn.',
    lim4: 'Nền tô màu sau chữ chưa co giãn theo chữ mới (gạch chân, gạch ngang thì có).',
    hint: 'Bấm vào một dòng chữ để sửa · Enter để lưu · Esc để huỷ',
    save: 'Lưu', cancel: 'Huỷ', ehint: 'Enter lưu · Esc huỷ',
    openOther: 'Mở file khác', download: 'Tải PDF',
    undo: 'Hoàn tác (Ctrl+Z)', redo: 'Làm lại (Ctrl+Y)', zoomIn: 'Phóng to', zoomOut: 'Thu nhỏ',
    loadingEngine: 'Đang nạp bộ máy PDF (lần đầu khoảng 4–5 MB)…', opening: 'Đang mở file…', saving: 'Đang đóng gói PDF…', editing: 'Đang sửa…',
    page: 'Trang',
    ok: 'Đã sửa.', okFont: 'Phông: {f}', reflowed: 'Đã dàn lại đoạn: {a} → {b} dòng.', decoFixed: 'Gạch chân/gạch ngang đã khớp chữ mới.', squeezed: 'Chữ mới dài hơn chỗ trống nên mình nén ngang còn {tz}%.',
    overflow: 'Chữ mới dài quá chỗ trống (đã nén tối đa 85%) nên có thể chạm chữ bên cạnh. Bạn nên rút gọn.',
    notFound: 'Không sửa được dòng này. Bạn thử bấm lại vào dòng sau khi trang vẽ xong.',
    noFont: 'Phông dự phòng thiếu ký tự cho chữ bạn gõ.',
    errPassword: 'File có mật khẩu, mình chưa mở được.', errNotPdf: 'Đây không phải file PDF hợp lệ.', errGeneric: 'Có lỗi: {e}',
    errWorker: 'Trình duyệt này chưa chạy được bộ máy PDF. Bạn thử Chrome, Edge hoặc Firefox bản mới.',
    undone: 'Đã hoàn tác.', redone: 'Đã làm lại.', saved: 'Đã tải về {n}.',
    leave: 'Bạn có thay đổi chưa tải về. Rời trang?',
    foot: '© LANHMAR · Mã nguồn mở AGPL-3.0', source: 'Mã nguồn trên GitHub',
    fromDrive: 'Mở từ Google Drive', saveDrive: 'Lưu vào Drive', driveCallBtn: 'Mở file từ Google Drive',
    driveCall: 'Bạn vừa bấm “Sửa PDF này” từ Drive. Bấm nút dưới để đăng nhập Google và mở file.',
    driveCallNamed: 'Bạn vừa bấm “Sửa PDF này” cho “{n}”. Bấm nút dưới để đăng nhập Google và mở file.',
    driveOff: 'Trang này chưa bật kết nối Google Drive. Bạn tải file về máy rồi mở bằng nút Chọn file PDF nhé.',
    drivePick: 'Google cần bạn chọn file này một lần để cấp quyền cho trang. Mình đã điền sẵn tên để tìm.',
    driveLoading: 'Đang tải file từ Google Drive…', driveSaving: 'Đang lưu bản sao vào Google Drive…',
    driveSaved: 'Đã lưu “{n}” vào Drive, cạnh file gốc.', driveOpen: 'Mở trên Drive', driveErr: 'Google Drive báo lỗi: {e}',
    driveAuth: 'Bạn chưa đăng nhập hoặc chưa cho phép quyền truy cập Google Drive.', copySuffix: ' (đã sửa)',
  },
  en: {
    kicker: '★ FREE · RUNS IN YOUR BROWSER',
    h1: 'Edit PDF text<br><em>like a document</em>',
    lead: 'Click any line of text, retype it, press Enter. Font, size, colour and layout stay as they were. Your file never leaves your device.',
    drop: 'Drop a PDF file here',
    choose: 'Choose a PDF', demo: 'Try a sample file',
    privacy: '🔒 Processed on your device with WebAssembly. No upload to any server, no account needed.',
    f1h: 'Keeps the original font', f1: 'Reuses the font inside the file, or a same-family font with full Vietnamese support when glyphs are missing.',
    f2h: 'Truly removes old text', f2: 'Old text is deleted from the file, not covered with white boxes. Search and copy return the new text.',
    f3h: 'Nothing else moves', f3: 'Only the paragraph you edit changes. Centring, right and justified alignment, bold, italic and underlines are kept; longer text flows to the next lines.',
    limH: 'What can’t it do yet?',
    lim1: 'Scanned PDFs or photos (no text layer).',
    lim2: 'Editing several lines at once: one line at a time for now; longer text flows into the following lines of the paragraph.',
    lim3: 'If the paragraph has no room left (the next one sits right below), text is condensed down to 85%; shorten it beyond that.',
    lim4: 'Background highlights do not resize with the new text yet (underlines and strikethroughs do).',
    hint: 'Click a line of text to edit · Enter to save · Esc to cancel',
    save: 'Save', cancel: 'Cancel', ehint: 'Enter save · Esc cancel',
    openOther: 'Open another file', download: 'Download PDF',
    undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Y)', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
    loadingEngine: 'Loading the PDF engine (about 4–5 MB the first time)…', opening: 'Opening file…', saving: 'Packing the PDF…', editing: 'Editing…',
    page: 'Page',
    ok: 'Edited.', okFont: 'Font: {f}', reflowed: 'Paragraph reflowed: {a} → {b} lines.', decoFixed: 'Underline/strikethrough resized to the new text.', squeezed: 'The new text is longer than the space, so it was condensed to {tz}%.',
    overflow: 'The new text is too long for the space (condensed to the 85% limit) and may touch the next text. Consider shortening it.',
    notFound: 'Could not edit this line. Try clicking it again once the page has rendered.',
    noFont: 'The fallback font lacks characters you typed.',
    errPassword: 'The file is password protected; not supported yet.', errNotPdf: 'This is not a valid PDF file.', errGeneric: 'Error: {e}',
    errWorker: 'This browser cannot run the PDF engine. Please try a recent Chrome, Edge or Firefox.',
    undone: 'Undone.', redone: 'Redone.', saved: 'Downloaded {n}.',
    leave: 'You have changes that are not downloaded. Leave the page?',
    foot: '© LANHMAR · Open source AGPL-3.0', source: 'Source code on GitHub',
    fromDrive: 'Open from Google Drive', saveDrive: 'Save to Drive', driveCallBtn: 'Open the file from Google Drive',
    driveCall: 'You clicked “Edit this PDF” in Drive. Click below to sign in with Google and open the file.',
    driveCallNamed: 'You clicked “Edit this PDF” for “{n}”. Click below to sign in with Google and open the file.',
    driveOff: 'Google Drive is not enabled on this page yet. Download the file and open it with Choose a PDF.',
    drivePick: 'Google needs you to pick this file once to grant the page access. The name is pre-filled.',
    driveLoading: 'Downloading the file from Google Drive…', driveSaving: 'Saving a copy to Google Drive…',
    driveSaved: 'Saved “{n}” to Drive next to the original.', driveOpen: 'Open in Drive', driveErr: 'Google Drive error: {e}',
    driveAuth: 'You are not signed in or did not allow Google Drive access.', copySuffix: ' (edited)',
  },
};
let lang = (() => { const ql = new URLSearchParams(location.search).get('lang'); if (ql === 'vi' || ql === 'en') return ql; try { const l = localStorage.getItem('lm_lang'); if (l === 'vi' || l === 'en') return l; } catch { /* ignore */ } return (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en'; })();
const T = (k, vars) => String(I18N[lang][k] ?? k).replace(/\{(\w+)\}/g, (_, v) => (vars && vars[v] != null ? vars[v] : ''));
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i]').forEach((el) => { el.textContent = T(el.dataset.i); });
  document.querySelectorAll('[data-ih]').forEach((el) => { el.innerHTML = T(el.dataset.ih); });
  document.querySelectorAll('[data-i-title]').forEach((el) => { el.title = T(el.dataset.iTitle); el.setAttribute('aria-label', el.title); });
  document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  document.querySelectorAll('.page .num').forEach((n) => { n.textContent = `${T('page')} ${+n.dataset.p + 1}`; });
}
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang; try { localStorage.setItem('lm_lang', lang); } catch { /* ignore */ } applyLang();
}));
applyLang();

// ---------- tiện ích ----------
const $ = (id) => document.getElementById(id);
function toast(msg, kind = '', sub = '', link = null) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  if (link) { const a = document.createElement('a'); a.href = link.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = link.label; t.appendChild(a); }
  if (sub) { const s = document.createElement('small'); s.textContent = sub; t.appendChild(s); }
  const box = $('toasts'); box.appendChild(t);
  while (box.children.length > 2) box.firstElementChild.remove();
  setTimeout(() => t.remove(), kind ? 7000 : 2600);
}
function busy(msg) { $('busy').hidden = !msg; $('busyMsg').textContent = msg || ''; }

// ---------- luồng nền ----------
let worker = null, seq = 0;
const pending = new Map();
let workerReady = null;
function startWorker() {
  if (workerReady) return workerReady;
  workerReady = new Promise((resolve, reject) => {
    try { worker = new Worker(new URL('./worker.js?v=7', import.meta.url), { type: 'module' }); } catch (e) { reject(e); return; }
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.ready) { resolve(); return; }
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id);
      m.ok ? p.resolve(m.result) : p.reject(new Error(m.error));
    };
    worker.onerror = (e) => { reject(new Error(e.message || 'worker')); };
  });
  return workerReady;
}
function call(cmd, ...args) {
  const id = ++seq;
  const transfer = args.filter((a) => a instanceof ArrayBuffer);
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ id, cmd, args }, transfer); });
}

// ---------- trạng thái ----------
const S = { name: '', pages: [], zoom: 1, edits: 0, dirty: false, editing: null, edited: new Map(), drive: null };

async function openBytes(buf, name, drive = null) {
  busy(T('loadingEngine'));
  try { await startWorker(); } catch { busy(); toast(T('errWorker'), 'err'); return; }
  busy(T('opening'));
  try {
    const { pages } = await call('open', buf);
    Object.assign(S, { name, pages, edits: 0, dirty: false, edited: new Map(), drive });
    $('saveDrive').hidden = !drive;
    $('home').hidden = true; $('viewer').hidden = false; $('tools').hidden = false;
    $('fname').textContent = name; $('fname').title = name;
    S.zoom = fitZoom();
    buildPages();
    setUndo({ canUndo: false, canRedo: false });
  } catch (e) {
    const m = e.message;
    toast(m === 'PASSWORD' ? T('errPassword') : m === 'NOT_PDF' ? T('errNotPdf') : T('errGeneric', { e: m }), 'err');
  } finally { busy(); }
}
function fitZoom() {
  const w = Math.max(...S.pages.map((p) => p.w));
  return Math.max(0.4, Math.min(1.6, (Math.min(window.innerWidth, 1100) - 40) / w));
}

// ---------- trang ----------
let observer = null;
function buildPages() {
  closeEditor(false);
  const box = $('pages'); box.innerHTML = '';
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) drawPage(+e.target.dataset.p); }), { rootMargin: '600px 0px' });
  S.pages.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'page'; d.dataset.p = i;
    d.style.width = p.w * S.zoom + 'px'; d.style.height = p.h * S.zoom + 'px';
    d.innerHTML = `<canvas></canvas><div class="ov"></div><span class="num" data-p="${i}">${T('page')} ${i + 1}</span>`;
    box.appendChild(d); observer.observe(d);
    p.drawn = 0;
  });
  $('zoomLabel').textContent = Math.round(S.zoom * 100) + '%';
}
async function drawPage(i, force = false) {
  const p = S.pages[i]; const d = document.querySelector(`.page[data-p="${i}"]`);
  if (!p || !d) return;
  const want = S.zoom * Math.min(window.devicePixelRatio || 1, 2.5);
  if (!force && p.drawn === want) return;
  p.drawn = want;
  const [img, lines] = await Promise.all([call('render', i, want), call('lines', i)]);
  if (p.drawn !== want) return; // đã đổi zoom trong lúc chờ
  const c = d.querySelector('canvas'); c.width = img.w; c.height = img.h;
  c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
  p.lines = lines; drawLines(i);
}
function drawLines(i) {
  const p = S.pages[i]; const ov = document.querySelector(`.page[data-p="${i}"] .ov`);
  if (!ov || !p.lines) return;
  ov.innerHTML = '';
  const edited = S.edited.get(i) || [];
  for (const l of p.lines) {
    const [x0, y0, x1, y1] = l.bbox, z = S.zoom;
    const el = document.createElement('div');
    el.className = 'ln'; el.dataset.i = l.i;
    Object.assign(el.style, { left: x0 * z - 2 + 'px', top: y0 * z - 1 + 'px', width: (x1 - x0) * z + 4 + 'px', height: (y1 - y0) * z + 2 + 'px' });
    if (edited.some((r) => !(r[2] < x0 || r[0] > x1 || r[3] < y0 || r[1] > y1))) el.classList.add('edited');
    el.addEventListener('click', (ev) => { ev.stopPropagation(); const box = el.parentElement.getBoundingClientRect(); openEditor(i, l, el, ev.clientX - box.left); });
    ov.appendChild(el);
  }
}

// ---------- ô sửa ----------
function openEditor(pi, line, el, clickX) {
  closeEditor(false);
  S.editing = { pi, line, el };
  el.classList.add('active');
  const ed = $('editor'), inp = $('editIn'), r = el.getBoundingClientRect(), z = S.zoom;
  const vw = document.documentElement.clientWidth;
  const w = Math.min(vw - 16, Math.max(r.width + 24, 300));
  Object.assign(ed.style, { left: Math.max(8, Math.min(r.left + window.scrollX - 8, window.scrollX + vw - w - 8)) + 'px', top: r.top + window.scrollY - 6 + 'px', width: w + 'px' });
  inp.style.fontSize = Math.max(14, Math.min(24, line.size * z)) + 'px';
  inp.style.fontWeight = line.bold ? '700' : '500';
  inp.style.fontStyle = line.italic ? 'italic' : 'normal';
  inp.classList.toggle('serif', !!line.serif);
  inp.value = line.text;
  ed.hidden = false; autosize(); inp.focus();
  // đặt con trỏ đúng chỗ bấm (không chọn hết dòng, tránh gõ nhầm xoá cả dòng)
  let pos = line.text.length;
  if (clickX != null && line.xs) {
    const xPt = clickX / z; pos = 0;
    while (pos < line.xs.length && line.xs[pos] < xPt) pos++;
    pos = Math.min(pos, line.text.length);
  }
  inp.setSelectionRange(pos, pos);
}
function autosize() { const inp = $('editIn'); inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 4 + 'px'; }
$('editIn').addEventListener('input', autosize);
function closeEditor(keepFocus) {
  if (!S.editing) return;
  S.editing.el.classList.remove('active');
  S.editing = null; $('editor').hidden = true;
  if (!keepFocus) document.activeElement && document.activeElement.blur && document.activeElement.blur();
}
async function saveEdit() {
  const e = S.editing; if (!e) return;
  const text = $('editIn').value.replace(/\s*\n\s*/g, ' ');
  closeEditor(false);
  if (text === e.line.text) return;
  busy(T('editing'));
  try {
    const { rep, canUndo, canRedo } = await call('edit', e.pi, e.line.i, text);
    setUndo({ canUndo, canRedo });
    if (rep.status === 'ok') {
      S.edits++; S.dirty = true;
      if (!S.edited.has(e.pi)) S.edited.set(e.pi, []);
      S.edited.get(e.pi).push(rep.region);
      const fonts = (rep.fonts || []).map((f) => f.replace(/ \(.*\)$/, '').replace(/-/g, ' ')).join(', ');
      let msg = T('ok');
      if (rep.reflow && rep.reflow.lines !== rep.reflow.was) msg += ' ' + T('reflowed', { a: rep.reflow.was, b: rep.reflow.lines });
      if (rep.decorations && rep.decorations.redrawn) msg += ' ' + T('decoFixed');
      if (rep.overflow) toast(T('overflow'), 'warn', T('okFont', { f: fonts }));
      else if (rep.tz && rep.tz < 100) toast(msg + ' ' + T('squeezed', { tz: rep.tz }), '', T('okFont', { f: fonts }));
      else toast(msg, '', T('okFont', { f: fonts }));
    } else if (rep.status !== 'unchanged') {
      toast(rep.status === 'no-font' ? T('noFont') : T('notFound'), 'err');
    }
    await drawPage(e.pi, true);
  } catch (err) { toast(T('errGeneric', { e: err.message }), 'err'); }
  finally { busy(); }
}
$('editSave').addEventListener('click', saveEdit);
$('editCancel').addEventListener('click', () => closeEditor(false));
$('editIn').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { ev.preventDefault(); saveEdit(); }
  else if (ev.key === 'Escape') { ev.preventDefault(); closeEditor(false); }
});
document.addEventListener('mousedown', (ev) => { if (S.editing && !$('editor').contains(ev.target) && !ev.target.classList.contains('ln')) closeEditor(false); });

// ---------- hoàn tác / zoom / tải về ----------
function setUndo({ canUndo, canRedo }) { $('undo').disabled = !canUndo; $('redo').disabled = !canRedo; }
async function undoRedo(kind) {
  closeEditor(false);
  const st = await call(kind);
  setUndo(st);
  S.dirty = st.canUndo;
  for (let i = 0; i < S.pages.length; i++) if (S.pages[i].drawn) await drawPage(i, true);
  toast(T(kind === 'undo' ? 'undone' : 'redone'));
}
$('undo').addEventListener('click', () => undoRedo('undo'));
$('redo').addEventListener('click', () => undoRedo('redo'));
document.addEventListener('keydown', (ev) => {
  if (S.editing || $('viewer').hidden) return;
  const k = ev.key.toLowerCase();
  if ((ev.ctrlKey || ev.metaKey) && k === 'z' && !ev.shiftKey && !$('undo').disabled) { ev.preventDefault(); undoRedo('undo'); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === 'y' || (k === 'z' && ev.shiftKey)) && !$('redo').disabled) { ev.preventDefault(); undoRedo('redo'); }
});
function setZoom(z) {
  const y = window.scrollY / Math.max(1, document.body.scrollHeight);
  S.zoom = Math.max(0.4, Math.min(3, z));
  buildPages();
  window.scrollTo(0, y * document.body.scrollHeight);
}
$('zoomIn').addEventListener('click', () => setZoom(S.zoom * 1.2));
$('zoomOut').addEventListener('click', () => setZoom(S.zoom / 1.2));

$('download').addEventListener('click', async () => {
  closeEditor(false);
  busy(T('saving'));
  try {
    const { bytes } = await call('save');
    const name = S.name.replace(/\.pdf$/i, '') + (lang === 'vi' ? '-da-sua.pdf' : '-edited.pdf');
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    S.dirty = false;
    toast(T('saved', { n: name }));
  } catch (e) { toast(T('errGeneric', { e: e.message }), 'err'); }
  finally { busy(); }
});
window.addEventListener('beforeunload', (ev) => { if (S.dirty) { ev.preventDefault(); ev.returnValue = T('leave'); } });

// ---------- mở file ----------
async function openFile(f) {
  if (!f) return;
  if (S.dirty && !confirm(T('leave'))) return;
  openBytes(await f.arrayBuffer(), f.name);
}
$('fileIn').addEventListener('change', (ev) => { openFile(ev.target.files && ev.target.files[0]); ev.target.value = ''; });
const drop = $('drop');
['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (ev) => { ev.preventDefault(); if (t === 'drop' || ev.target === document.documentElement) drop.classList.remove('over'); }));
document.addEventListener('drop', (ev) => { const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f) openFile(f); });
$('demo').addEventListener('click', async () => {
  const r = await fetch(new URL('../spike/samples/s1-word-times.pdf', import.meta.url));
  openBytes(await r.arrayBuffer(), lang === 'vi' ? 'mau-bao-cao.pdf' : 'sample-report.pdf');
});
// ---------- Google Drive ----------
function driveError(e) {
  busy();
  if (/AUTH|popup|access_denied/i.test(e.message)) toast(T('driveAuth'), 'err');
  else toast(T('driveErr', { e: e.message }), 'err');
}
async function openDriveFile(id, nameHint) {
  try {
    let got;
    try { busy(T('driveLoading')); got = await loadFile(id); }
    catch (e) {
      if (e.status !== 403 && e.status !== 404) throw e;
      // drive.file: trang chưa có quyền với file này → người dùng chọn file một lần trong Picker
      busy(); toast(T('drivePick'));
      const picked = await pickPdf(lang, nameHint || '');
      if (!picked) return;
      busy(T('driveLoading')); got = await loadFile(picked.id);
    }
    busy();
    $('driveCall').hidden = true;
    await openBytes(got.bytes, got.meta.name, { id: got.meta.id, parents: got.meta.parents || [], link: got.meta.webViewLink });
  } catch (e) { driveError(e); }
}
$('fromDrive').addEventListener('click', async () => {
  if (S.dirty && !confirm(T('leave'))) return;
  try { const picked = await pickPdf(lang); if (picked) await openDriveFile(picked.id, picked.name); } catch (e) { driveError(e); }
});
$('saveDrive').addEventListener('click', async () => {
  if (!S.drive) return;
  closeEditor(false);
  busy(T('driveSaving'));
  try {
    const { bytes } = await call('save');
    const name = S.name.replace(/\.pdf$/i, '') + T('copySuffix') + '.pdf';
    const f = await saveCopy(bytes, name, S.drive.parents);
    S.dirty = false;
    busy(); toast(T('driveSaved', { n: f.name || name }), '', '', f.webViewLink ? { href: f.webViewLink, label: T('driveOpen') } : null);
  } catch (e) { driveError(e); }
});
{
  const q = new URLSearchParams(location.search);
  const id = q.get('id'), nm = q.get('name') || '';
  $('fromDrive').hidden = !driveEnabled();
  if (id && /^[\w-]{10,}$/.test(id)) {
    $('driveCall').hidden = false;
    if (!driveEnabled()) { $('driveCallMsg').textContent = T('driveOff'); $('driveCallBtn').hidden = true; }
    else {
      $('driveCallMsg').textContent = nm ? T('driveCallNamed', { n: nm }) : T('driveCall');
      $('driveCallBtn').addEventListener('click', () => openDriveFile(id, nm));
    }
  }
}

// nạp sẵn bộ máy khi trình duyệt rảnh để lần mở đầu nhanh hơn
(window.requestIdleCallback || setTimeout)(() => startWorker().catch(() => {}));

// cho kiểm thử tự động
window.__lm = { S, call };
