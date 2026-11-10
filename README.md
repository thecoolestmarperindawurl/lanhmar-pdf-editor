# LANHMAR PDF Editor

**VI** — Trình sửa PDF miễn phí cho mọi người, chạy hoàn toàn trong trình duyệt: bấm vào chữ có sẵn trong PDF và sửa trực tiếp, giữ phông và bố cục. File không rời máy bạn, không cần tài khoản, không có máy chủ.

**EN** — A free PDF editor for everyone that runs entirely in the browser: click existing text in a PDF and edit it in place, keeping fonts and layout. Files never leave your device; no account, no server.

> **Trạng thái / Status:** bản web đầu tiên chạy được: mở PDF, bấm vào dòng để sửa, hoàn tác/làm lại, tải về. Thử chất lượng: 26/26 ca trên PDF thật (Notion, Word, Canva). / First web version works: open a PDF, click a line to edit, undo/redo, download. Quality: 26/26 cases on real PDFs (Notion, Word, Canva).

## Dùng / Use

1. Mở trang (sau khi bật GitHub Pages: `https://thecoolestmarperindawurl.github.io/lanhmar-pdf-editor/`), bấm **Chọn file PDF** hoặc kéo thả. / Open the page and pick or drop a PDF.
2. Bấm vào dòng chữ cần sửa → ô sửa hiện đúng chỗ, con trỏ ở chỗ bạn bấm → gõ → **Enter** để lưu, **Esc** để huỷ. / Click a line, type, Enter to save, Esc to cancel.
3. **↶ / ↷** (hoặc Ctrl+Z / Ctrl+Y) để hoàn tác / làm lại. **Tải PDF** để lưu file đã sửa (đã cắt phông cho gọn). / Undo/redo, then Download.

Chạy trên máy / Run locally (cần máy chủ tĩnh, không mở thẳng file:// được vì Web Worker và WASM):

```bash
python3 -m http.server 8000   # rồi mở http://localhost:8000
```

## Cấu trúc / Layout

| Đường dẫn | Vai trò |
|---|---|
| `index.html`, `app/` | Giao diện web (song ngữ VI/EN) và luồng nền `app/worker.js` chạy MuPDF |
| `src/edit.mjs` | Lõi sửa chữ, dùng chung cho trình duyệt và bộ thử |
| `vendor/mupdf/` | MuPDF.js 1.28.6 bản trình duyệt (AGPL-3.0) |
| `fonts/` | Phông dự phòng đủ dấu tiếng Việt |
| `spike/` | Bộ thử chất lượng và báo cáo |

## Cách hoạt động / How it works

Dùng [MuPDF.js](https://www.npmjs.com/package/mupdf) (WebAssembly). Mỗi lần sửa / Each edit:

1. Đọc từng ký tự của trang: vị trí, phông, cỡ, màu. / Read every character with position, font, size, colour.
2. **Xoá thật** chữ cũ (redaction), không che ô trắng. / **Truly remove** the old text (redaction), no white boxes.
3. Chọn phông: dùng lại phông gốc nếu đủ ký tự; nếu thiếu (thường gặp với dấu tiếng Việt) thì dùng phông cùng họ hoặc phông có độ rộng ký tự khớp nhất. / Pick a font: reuse the embedded one when it has every glyph; otherwise a same-family or width-matched fallback with full Vietnamese coverage.
4. Viết chữ mới đúng vị trí, cỡ, màu; không tràn sang cột hay ô bảng bên cạnh. / Write the new text at the same origin, size and colour, without spilling into the next column or table cell.

## Thử chất lượng / Quality spike

```bash
npm install
npm run spike            # mẫu tổng hợp → spike/report/REPORT.md
node spike/run.mjs --real   # PDF thật trong spike/samples/real/ (không commit)
```

Kết quả hiện tại và nhận định: [`spike/report/REPORT.md`](spike/report/REPORT.md), [`spike/FINDINGS.md`](spike/FINDINGS.md).

## Giấy phép / License

**AGPL-3.0-or-later** (xem `LICENSE`), vì dùng MuPDF.js bản AGPL. Bạn được dùng, sửa, chia sẻ, kể cả thương mại, với điều kiện công khai mã nguồn của bản sửa đổi khi cung cấp cho người khác (kể cả qua mạng). Thư viện và phông bên thứ ba: `THIRD-PARTY-NOTICES.md`. / Third-party libraries and fonts: see `THIRD-PARTY-NOTICES.md`.

Tác giả / Author: Dương Thị Lan Anh (LANHMAR) · https://lanhmar.id.vn
