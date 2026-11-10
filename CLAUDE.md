# lanhmar-pdf-editor — ghi chú cho Claude Code

Trình sửa PDF miễn phí cho mọi người của LANHMAR, mục tiêu **sửa chữ gốc trong PDF (mức 3)**, chạy hoàn toàn trong trình duyệt. Tác giả: Dương Thị Lan Anh (LANHMAR). Brand: skill `lanhmar-brand-guideline` (tím `#2D2FEF`, cam `#FF7A45`, Montserrat, bo tròn, xưng "mình"). Giao diện song ngữ VI/EN (`localStorage lm_lang`, cùng khoá với lanhmar.id.vn).

## Ràng buộc đã chốt
- **Miễn phí cho mọi người, không chi phí định kỳ**: không máy chủ, không SDK thương mại. Host tĩnh trên GitHub Pages.
- **File không rời máy người dùng**: xử lý bằng WebAssembly trong trình duyệt.
- Engine dự kiến: **MuPDF.js** (gói npm `mupdf`, giấy phép AGPL-3.0 hoặc thương mại). Repo này công khai nên dùng AGPL; ghi rõ giấy phép trong `LICENSE` và `THIRD-PARTY-NOTICES.md`.
- Đã loại: Stirling PDF tự host (tốn máy chủ, giấy phép trả phí khi trên 5 người dùng/tổ chức, trình sửa chữ còn alpha), Apryse/Nutrient (trả phí), LibreOffice Draw (không phải sản phẩm của mình).

## Mục tiêu chất lượng thực tế
PDF lưu từng cụm ký tự ở toạ độ cố định, phông thường chỉ nhúng ký tự đã dùng. Mục tiêu: bấm vào một dòng/đoạn → sửa → chữ dàn lại trong khung đó → phông khớp gần nhất (dự phòng phông có đủ dấu tiếng Việt, ví dụ Be Vietnam Pro / Noto Sans / Noto Serif) → chữ cũ bị **xoá thật** (redaction), không chỉ che trắng. Không hứa sửa như Word.

## Cấu trúc repo
- `index.html` + `app/app.js`, `app/app.css`: giao diện web (song ngữ, brand LANHMAR). `app/worker.js`: Web Worker giữ tài liệu, chạy MuPDF, lệnh `open/render/lines/edit/undo/redo/save`. Phông dự phòng nạp bằng XHR đồng bộ trong Worker (được phép), có bộ đệm. Hoàn tác/làm lại dùng nhật ký MuPDF (`enableJournal`, `beginOperation`/`endOperation`/`abandonOperation`, `undo`/`redo`).
- `vendor/mupdf/`: MuPDF.js bản dist (mupdf.js, mupdf-wasm.js, mupdf-wasm.wasm ~10 MB); cập nhật thì chép lại từ `node_modules/mupdf/dist` và sửa `VERSION`.
- `src/edit.mjs`: lõi sửa chữ (dùng chung cho Node và trình duyệt; MuPDF tiêm vào bằng `useMupdf()`). API cho giao diện: `lineInfo(page)` (dòng nhìn thấy, có `xs` vị trí ký tự), `editLine(doc, page, lineIndex, newText, {loadFont})` (so khác biệt đầu/cuối, chỉ viết lại phần đổi). Chọn phông theo từng nhóm ký tự: A dùng lại phông gốc nếu có tên và đủ ký tự → B phông cùng họ/đo bằng theo tên (Times→Liberation Serif, Arial→Liberation Sans, Calibri→Carlito, Inter) → C với phông lạ/Type3: chốt một họ cho cả trang bằng độ rộng ký tự gộp, chọn độ đậm từng phông bằng **lượng mực** (vẽ lại ký tự gốc bằng phông ứng viên, so điểm tối), phông quá ít ký tự mượn độ đậm của ký tự gần nhất. Kiểu chữ giữ **theo từng ký tự** khi dựng lại đuôi dòng (`buildSequence`).
- Gạch chân/gạch ngang: `thinRules()` thu nét ngang mỏng bằng Device tự viết (tuỳ chọn stext `collect-vectors` không có trong bản 1.28), `decorationsOf()` lọc theo vị trí so với chân chữ; xoá bằng redaction `LINE_ART_REMOVE_IF_COVERED` + `TEXT_NONE`, vẽ lại `re f`.
- Dàn lại đoạn: `paragraphAfter/Before()` (cùng cỡ, cùng lề, khoảng dòng ±12%), `planReflow()` ngắt dòng tham lam vào các ô dòng sẵn có + tối đa 1 dòng thêm nếu trống; căn đều khi dấu cách gốc giãn > 1,04 lần; đoạn căn đều thì viết lại cả dòng (`opts._full`). Mỗi từ là một mảnh có toạ độ riêng (Identity-H không dùng được Tw).
- Dòng nhìn thấy (`readLines`): ghép các mảnh MuPDF cùng chân chữ, nối tiếp nhau (khoảng cách −1…0,6 cỡ chữ); không ghép mảnh chồng lên nhau (biểu tượng Canva vẽ đè).
- `spike/run.mjs`: bộ thử 6 tiêu chí, `npm run spike` (mẫu tổng hợp) hoặc `node spike/run.mjs --real` (PDF thật trong `spike/samples/real/`, không commit). Báo cáo `spike/report/REPORT.md`, nhận định `spike/FINDINGS.md`.
- `spike/make-samples.mjs`: sinh mẫu bằng Chromium (cần Playwright). Mẫu đã commit.
- `fonts/`: phông dự phòng đủ dấu tiếng Việt (Liberation, Carlito, DejaVu, Inter) + `fonts/licenses/`. Caladea (thay Cambria) **thiếu dấu tiếng Việt**, không dùng.
- Giấy phép repo: **AGPL-3.0-or-later** (bắt buộc vì dùng MuPDF.js bản AGPL).

## Bài học kỹ thuật đã gặp
- `toPixmap().getPixels()` trả về vùng nhớ WASM, phải `.slice()` ngay, nếu không dữ liệu bị ghi đè (ảnh đen, so điểm ảnh sai).
- `saveToBuffer()` trả `mupdf.Buffer`, dùng `.asUint8Array().slice()` trước khi đưa cho Node/pdf.js.
- Chromium nhúng phông CFF/OTF thành nhiều phông Type3 không tên, mỗi cái vài ký tự (không theo kiểu chữ): đo độ rộng gộp cả trang để chốt họ phông, còn độ đậm xét riêng từng phông con.
- Tiêu chí tự động chưa đủ: luôn xem ảnh trước/sau (từng có ca "đạt" nhưng mất in đậm, mất SemiBold, in đậm cả dòng trộn).
- Độ rộng ký tự phân biệt được họ phông nhưng **không** phân biệt được độ đậm của Inter; dùng lượng mực.
- Lượng mực phải tự xác định nền là điểm khác màu chữ nhất (chữ sáng trên nền tối thì nền là điểm tối nhất).
- Luôn tự ghi ToUnicode cho chữ được viết: cmap phông nhúng của Word/Canva ánh xạ dấu cách sang U+00A0, làm tìm/copy sai.
- Dòng căn giữa/căn phải: viết lại cả dòng và đặt lại vị trí (`alignmentOf`); dòng chạm lề trái luôn là căn trái.
- **Không bao giờ `saveToBuffer('garbage=...')` trên tài liệu đang sửa**: dọn rác đánh số lại đối tượng, lần sửa sau làm mất chữ. Tải về = lưu thô (`compress=yes`) → mở bản sao → `subsetFonts()` → `garbage=compact` (đã kiểm: 0 điểm ảnh khác, CV 585→326 KB).
- Ô sửa: không chọn sẵn cả dòng (gõ nhầm mất dòng); đặt con trỏ theo `xs` tại chỗ bấm.
- Notion xuất PDF qua Headless Chrome: gần như toàn bộ là Type3, tiêu đề Inter SemiBold, tiêu đề bìa Inter Bold; gạch chân link mục lục là nét vẽ rời.

## Bước 1: thử nghiệm chất lượng (làm trước, chưa xây giao diện thật)
Bộ mẫu ~10 PDF tiếng Việt thật: xuất từ Word, Google Docs, Canva, sách dàn trang (InDesign), slide, bản scan. Chấm từng file theo 4 tiêu chí, ghi vào `spike/REPORT.md`:
1. Trích chữ đúng, đủ dấu tiếng Việt.
2. Sửa một câu: phông khớp, không lộ đường sửa.
3. Bố cục quanh chỗ sửa giữ nguyên.
4. File kết quả mở đúng trong Chrome, Acrobat Reader, và extract lại thấy chữ mới, không còn chữ cũ.
Trạng thái 10/11/2026: mẫu tổng hợp 10/11 ca đạt (ca còn lại là bản scan, cần OCR); **bộ thật 7 file (5 bài giảng Notion, thư mời Word 2021, CV Canva): 26/26 ca đạt, ảnh không lộ đường sửa**. Chi tiết `spike/FINDINGS.md`. Bộ thật tải từ thư mục Drive của chủ dự án (id `10OS1QAeY3LMDaGPnjzDOiYmUIkbdbvwh`) qua `drive.usercontent.google.com` vào `spike/samples/real/` (không commit); thư mời và CV do chủ dự án gửi trực tiếp (có thông tin cá nhân, tuyệt đối không commit); còn thiếu mẫu InDesign/Google Docs.
**Đã đạt → giao diện bấm-vào-dòng-để-sửa đã xây (10/11/2026)**: mở/kéo thả, sửa dòng ~0,35–0,75 s/lần, hoàn tác/làm lại, tải về có cắt phông, song ngữ, điện thoại. Đã thêm gạch chân/gạch ngang và dàn lại đoạn. Việc tiếp: bật GitHub Pages + tên miền, tích hợp Google Drive, đưa lên Kho Ứng dụng/Kho báu. Không đạt → báo bằng số liệu, lùi về phương án chú thích + thao tác trang (PDF.js editor + pdf-lib).

## Tích hợp với hệ LANHMAR (đã có sẵn, dùng lại)
- Project Google Cloud của Drive Ebook Reader: project number `313294325944`, OAuth app đã **In production** với scope `drive.file` (không nhạy cảm, không cần xác minh). Trang Google Picker mẫu: `drive-picker.html` trong repo `lanhmar-hub`.
- Tên miền `lanhmar.id.vn` đã xác minh trong Search Console (loại Domain, phủ cả tên miền con). Dự kiến host repo này ở `pdf.lanhmar.id.vn` (CNAME → `thecoolestmarperindawurl.github.io`).
- Cần thêm khi tích hợp Drive: OAuth client loại **Web application** trong cùng project (Authorized JavaScript origin `https://pdf.lanhmar.id.vn`), thêm `https://pdf.lanhmar.id.vn/*` vào giới hạn Websites của API key Picker. Cùng project nên quyền `drive.file` có thể dùng chung với extension: **cần thử**.
- Extension Drive Ebook Reader (`lanhmar-hub/extensions/drive-ebook-reader/`) sẽ thêm nút "Sửa PDF này" mở `https://pdf.lanhmar.id.vn/?id=<fileId>`.
- Khi ra mắt: thêm thẻ vào Kho Ứng dụng (`kho-featured.json` + EN) và Kho báu (`kho-bau-data.js`, đặt đầu danh sách, có `hook`/`hook_en`) trong repo `lanhmar-hub`, theo `CLAUDE.md` của repo đó.

## Quy ước làm việc
- Không đẩy thẳng lên `main`; làm trên nhánh, mở PR. Kiểm tra bằng Playwright/Chromium trước khi push.
- Không bịa số liệu chất lượng; mọi kết luận về engine phải kèm file mẫu và kết quả đo.
