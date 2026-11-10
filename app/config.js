// Cấu hình tích hợp Google Drive. Để trống GOOGLE_CLIENT_ID thì các nút Drive bị ẩn, trang vẫn chạy bình thường.
// Google Drive settings. Leave GOOGLE_CLIENT_ID empty to hide the Drive buttons; the page still works.
export const CONFIG = {
  // OAuth client loại "Web application" trong project 313294325944, Authorized JavaScript origins:
  //   https://thecoolestmarperindawurl.github.io  và  https://pdf.lanhmar.id.vn
  GOOGLE_CLIENT_ID: '313294325944-epjetulpjk7nsgnebcvi5o5o2kjocqph.apps.googleusercontent.com',
  // API key của Google Picker (đã có), cần thêm referrer cho 2 origin ở trên.
  PICKER_API_KEY: 'AIzaSyAldsyFuxYINXtz2i1jPnB_NaQ4qVh07_c',
  GOOGLE_APP_ID: '313294325944',
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
};
