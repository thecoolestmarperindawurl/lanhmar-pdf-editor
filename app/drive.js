// Google Drive: đăng nhập (Google Identity Services), chọn file (Google Picker), tải file, lưu bản sao.
// Chỉ dùng quyền drive.file: trang chỉ thấy file người dùng tự chọn hoặc file do trang tạo ra.
import { CONFIG } from './config.js';

const API = 'https://www.googleapis.com/drive/v3/';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink';
export const driveEnabled = () => !!CONFIG.GOOGLE_CLIENT_ID;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => resolve(); s.onerror = () => reject(new Error('LOAD ' + src));
    document.head.appendChild(s);
  });
}

let token = null, tokenExp = 0, tokenClient = null;
/** Lấy access token (bật cửa sổ Google lần đầu; phải gọi từ một cú bấm của người dùng). */
export async function getToken(forcePrompt = false) {
  if (token && Date.now() < tokenExp - 60000 && !forcePrompt) return token;
  await loadScript('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    const cb = (resp) => {
      if (!resp || resp.error || !resp.access_token) { reject(new Error((resp && resp.error) || 'AUTH')); return; }
      token = resp.access_token; tokenExp = Date.now() + (resp.expires_in || 3600) * 1000; resolve(token);
    };
    tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CONFIG.GOOGLE_CLIENT_ID, scope: CONFIG.SCOPE, callback: cb, error_callback: (e) => reject(new Error((e && e.type) || 'AUTH')) });
    tokenClient.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
  });
}

/** Mở Google Picker để chọn PDF; query: chữ tìm sẵn (vd. tên file). Trả về { id, name } hoặc null nếu huỷ. */
export async function pickPdf(lang, query = '') {
  const tk = await getToken();
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((r) => gapi.load('picker', r));
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes('application/pdf').setIncludeFolders(true).setSelectFolderEnabled(false);
    if (query) view.setQuery(query);
    const picker = new google.picker.PickerBuilder()
      .setAppId(CONFIG.GOOGLE_APP_ID).setDeveloperKey(CONFIG.PICKER_API_KEY).setOAuthToken(tk)
      .setOrigin(location.protocol + '//' + location.host).setLocale(lang === 'vi' ? 'vi' : 'en')
      .addView(view)
      .addView(new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes('application/pdf').setOwnedByMe(false))
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .setCallback((d) => {
        if (d.action === google.picker.Action.PICKED && d.docs && d.docs[0]) resolve({ id: d.docs[0].id, name: d.docs[0].name });
        else if (d.action === google.picker.Action.CANCEL) resolve(null);
      })
      .build();
    picker.setVisible(true);
  });
}

async function api(path, init = {}) {
  const tk = await getToken();
  const res = await fetch(path.startsWith('http') ? path : API + path, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + tk } });
  if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
  return res;
}

/** Tải metadata + nội dung PDF. Lỗi 404/403 nghĩa là trang chưa được cấp quyền với file này (cần chọn qua Picker). */
export async function loadFile(id) {
  const meta = await (await api(`files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,parents,webViewLink&supportsAllDrives=true`)).json();
  if (meta.mimeType !== 'application/pdf') { const e = new Error('NOT_PDF'); e.status = 415; throw e; }
  const bytes = await (await api(`files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`)).arrayBuffer();
  return { meta, bytes };
}

/** Lưu bản đã sửa thành file mới cạnh file gốc (quyền drive.file cho phép tạo file). */
export async function saveCopy(bytes, name, parents) {
  const boundary = 'lmpdf' + Math.random().toString(36).slice(2);
  const meta = { name, mimeType: 'application/pdf', ...(parents && parents.length ? { parents: [parents[0]] } : {}) };
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
  const body = new Blob([head, bytes, `\r\n--${boundary}--`]);
  const res = await api(UPLOAD, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return res.json();
}
