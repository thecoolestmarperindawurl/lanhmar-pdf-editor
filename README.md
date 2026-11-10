# LANHMAR PDF Editor

**VI** — Trình sửa PDF miễn phí cho mọi người, chạy hoàn toàn trong trình duyệt: bấm vào chữ có sẵn trong PDF và sửa trực tiếp, giữ phông và bố cục. File không rời máy bạn, không cần tài khoản, không có máy chủ.

**EN** — A free PDF editor for everyone that runs entirely in the browser: click existing text in a PDF and edit it in place, keeping fonts and layout. Files never leave your device; no account, no server.

> **Trạng thái / Status:** đang thử nghiệm chất lượng (spike). Chưa có giao diện người dùng. / Quality spike in progress; no user interface yet.

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
