# Nhận định sau ba lượt thử (10/11/2026)

## Dữ liệu thử

| Bộ | Nguồn | Số file | Số ca sửa |
|---|---|---|---|
| Tổng hợp | Chromium xuất từ HTML: Times, Arial + bảng, Calibri hai cột, phông lạ, slide Inter, bản scan | 6 | 11 |
| **Thật** | 5 bài giảng quản lý dự án, **Notion xuất PDF** (Headless Chrome 128), 12–21 trang, 3,7–9 MB | 5 | 14 |
| **Thật** | Thư mời, **Microsoft Word 2021** (Times New Roman thường/đậm/nghiêng) | 1 | 5 |
| **Thật** | CV 3 trang, **Canva** (Arial thường/đậm/nghiêng, nhiều màu) | 1 | 7 |

Bộ thật không đưa lên repo (tài liệu khoá học, thông tin cá nhân). Báo cáo của bộ thật nằm ở `spike/report-real/` trên máy chạy thử, không commit. Bảng và ảnh của bộ tổng hợp: [`report/REPORT.md`](report/REPORT.md).

## Kết quả đo được

| Chỉ số | Tổng hợp | Thật |
|---|---|---|
| Ca đạt đủ 6 tiêu chí tự động | 10/11 | **26/26** (Notion 14/14 · Word 5/5 · Canva 7/7) |
| Điểm ảnh đổi ngoài vùng sửa | 0 ở mọi ca | 0 ở mọi ca |
| Chữ mới đọc được bằng MuPDF và pdf.js | 10/10 | 26/26 |
| Chữ cũ còn sót trong lớp chữ | 0 | 0 |
| Ca phải co ngang chữ | 3 (87–99%) | 1 (91%, dòng nghiêng gần đầy) |
| Trích chữ tiếng Việt đúng dấu từ file gốc | 5/6 file (trừ bản scan) | 7/7 file |
| Cách chọn phông (bộ thật, theo đoạn chữ) | | nhận dạng 13 · cùng họ 7 · dùng lại phông gốc 5 · mượn 2 |
| Dung lượng lõi WASM khi tải trên web | 10,4 MB gốc · 4,7 MB gzip · 3,6 MB brotli | |

Ca không đạt duy nhất là bản scan, không có lớp chữ, đúng dự kiến.

## Điều bộ thật dạy thêm (bộ tổng hợp không bắt được)

PDF xuất từ Notion gần như toàn bộ là **phông Type3 không tên**, bị Chrome chia vụn thành hàng chục phông con, mỗi cái vài ký tự. Ba lỗi lộ ra khi xem ảnh, dù bảng tự động vẫn báo "đạt":

1. **Mất độ đậm vừa**: tiêu đề Notion là Inter SemiBold. Bộ phông chỉ có Regular/Bold nên tiêu đề sửa xong thành chữ thường. → Thêm Inter Medium và SemiBold.
2. **Độ rộng ký tự không đủ để phân biệt độ đậm** (Inter các độ đậm có độ rộng gần nhau). → Chọn độ đậm bằng **lượng mực**: vẽ lại đúng các ký tự gốc bằng từng độ đậm ứng viên tại đúng vị trí, so lượng điểm tối với bản gốc. Lệch còn 0–4,6% (một ca chữ xám mục lục lệch 28% nhưng vẫn chọn đúng Regular).
3. **Dòng trộn thường/đậm** ("Nên áp dụng cho nhóm **3-5 người trở lên**.") bị in đậm cả câu. → Giữ kiểu chữ **theo từng ký tự**: phần giống nhau ở đầu/cuối giữ kiểu gốc, phần mới lấy kiểu của chữ nó thay thế, đuôi dòng giữ kiểu gốc. Kết quả: "nhóm **từ 4 người trở lên**".

Thêm: chốt **một họ phông cho cả trang** (gộp số đo mọi phông Type3) để tránh dòng bị trộn hai họ; chữ số đứng lẻ mượn độ đậm của ký tự gần nhất đo được.

Kết quả bằng mắt trên bộ thật: tiêu đề bìa 30pt, tiêu đề cấp 2–3, thân bài, chữ xám mục lục, dòng có emoji ✅, ngoặc kép cong, dòng trộn đậm/thường đều **không phân biệt được chỗ sửa**. Có cả một lỗi chính tả thật trong tài liệu được sửa: “TỔNG LẾT” → “TỔNG KẾT”.

## Điều PDF của Word và Canva dạy thêm

1. **Dấu cách thành U+00A0.** Khi dùng lại phông nhúng gốc, bảng ký tự của phông Word/Canva ánh xạ glyph dấu cách sang “dấu cách không ngắt dòng”. Nhìn đúng nhưng tìm kiếm và copy sai (2 ca trượt tiêu chí). → Tự ghi bảng ToUnicode cho mọi chữ được viết, theo đúng chữ người dùng gõ. Sau sửa: 26/26.
2. **Dòng căn giữa / căn phải bị lệch khi chữ đổi độ dài** (tiêu đề “THƯ MỜI” → “THƯ MỜI THAM DỰ” lệch 39 điểm). → Nhận biết kiểu căn của dòng; với dòng căn giữa/phải thì viết lại cả dòng và đặt lại vị trí. Sau sửa: lệch tâm 0, lệch mép phải 0.
3. Phông có tên (Times New Roman, Arial) đi nhánh “dùng lại phông gốc” khi đủ ký tự, nếu thiếu dấu thì sang Liberation đo bằng: bằng mắt không phân biệt được, kể cả chữ nghiêng, chữ màu, tên người có dấu mới (“Nguyễn Minh Thư”).

## Gạch chân, gạch ngang và dàn lại đoạn (10/11/2026)

- **Gạch chân / gạch ngang vẽ rời** (link mục lục Notion, CSS `text-decoration`): tìm nét ngang mỏng ngay dưới chân chữ hoặc xuyên thân chữ, nằm trong phạm vi chữ (viền bảng dài hơn chữ bị loại); xoá bằng một lượt redaction chỉ bỏ nét vẽ, rồi vẽ lại đúng màu/độ dày theo độ dài chữ mới. Chỉ vẽ lại khi chắc chắn nét cũ đã mất (tránh gạch đôi). Mẫu `s7-decorations`: 3/3; ca mục lục Notion: gạch chân ngắn lại theo chữ.
- **Dàn lại đoạn** (đoạn căn trái hoặc căn đều): chữ dài ra đẩy từ xuống các dòng sau của đoạn, chữ ngắn đi trong đoạn căn đều kéo từ lên; giữ căn đều (đo dấu cách giãn: căn trái 0,99–1,01, căn đều ≥ 1,07, ngưỡng 1,04) và viết lại cả dòng để khoảng cách từ đều; thêm tối đa một dòng khi ngay dưới đoạn còn trống ít nhất nửa khoảng dòng, nếu không thì quay về co ngang và báo tràn. Các ca trước đây phải co 87–91% nay giữ 100%.

| Ca | Trước | Sau |
|---|---|---|
| Báo cáo căn đều, chữ dài hơn | co 89% | dàn lại 2 dòng, căn đều |
| Báo cáo căn đều, rút gọn | dòng hụt giữa đoạn | kéo chữ dòng dưới lên |
| Dòng cuối đoạn dài ra, dưới còn trống | co | thêm 1 dòng ở đúng lề trái |
| Dòng cuối đoạn dài ra, đoạn sau chặn | co | co 85% và báo tràn (đúng dự kiến, không chèn dòng đè) |
| Hợp đồng phông lạ (căn trái) | co 87% | dàn lại, vẫn căn trái |
| CV Canva, dòng nghiêng | co 91% | dàn lại 2 dòng |

## Kiểm thử diện rộng (fuzz) và lỗi tìm ra (10/11/2026)

Lỗi người dùng báo ("Cannot read properties of undefined (reading 'font')" khi sửa thư mời) dẫn tới hai bộ thử mới: sửa **mọi dòng** theo 5 kiểu (`spike/fuzz.mjs`) và **sửa liên tiếp** nhiều dòng trên cùng tài liệu (`spike/multi.mjs`). Chúng tìm ra 6 lỗi, đã sửa hết:

| Lỗi | Hậu quả | Sửa |
|---|---|---|
| Đo dấu cách dòng phía trên đoạn bằng phông chưa chọn | Ngoại lệ khi sửa đoạn căn đều (lỗi người dùng gặp) | Đo bằng phông gốc khi kiểu đó không được viết lại |
| Rò bộ nhớ WASM (trang chữ, ảnh, tài liệu tạm, chú thích, một Font mỗi ký tự) | Bộ nhớ tăng ~4 MB mỗi lần đọc/sửa; bộ thử cạn bộ nhớ | Huỷ chủ động, gom Font theo con trỏ |
| Redaction xoá oan ký tự kề (khung glyph Type3 rộng) | "study:" thành "stud:" | Vẽ lại ký tự mất oan |
| `addFont` dùng chung đối tượng PDF, ToUnicode bị ghi đè | Sửa dòng thứ hai làm dòng trước thành ký tự rác khi copy (21/76 dòng khi tắt bản sửa) | Gộp ToUnicode theo đối tượng PDF |
| Chữ mới chạy sát cột bên (khe 4 pt) | Dính với cột/ô bên thành một dòng | Khe ≥ 0,8 cỡ chữ |
| Giá trị trong bảng thuộc tính bị coi là căn giữa | Bị dời đè lên nhãn | Có chữ cùng hàng → căn trái |

Kết quả cuối: thật **1.390 lần sửa, 0 lỗi, 0 mất chữ** (59 lần chữ quá dài cho chỗ trống, đều có cảnh báo tràn); tổng hợp 215 lần, 0 lỗi; sửa liên tiếp 100 lần, 0 dòng hỏng; bộ chất lượng giữ 16/17 và 26/26.

## Hạn chế còn lại (thứ tự ưu tiên)

1. **Nền tô sau chữ** (highlight, nhãn màu) chưa co giãn theo chữ mới; gạch chân/gạch ngang thì đã xử lý. Khi dòng có gạch chân thì chưa dàn lại đoạn (giữ cách một dòng).
2. **Dàn lại đoạn chỉ trong phạm vi đoạn** + tối đa một dòng thêm; không đẩy các đoạn phía dưới xuống.
3. **Thứ tự đọc**: chữ mới ghi ở cuối luồng nội dung, copy cả trang thì cụm vừa sửa nằm cuối.
4. **Chỉ sửa trong một dòng**; cụm vắt hai dòng chưa hỗ trợ.
5. **Bản scan** cần OCR (chưa làm; ứng viên miễn phí: Tesseract.js, cần kiểm chứng với tiếng Việt).
6. **Chữ nghiêng** của phông Type3 chưa nhận dạng được (đang mặc định chữ đứng).
7. **Độ phủ nguồn**: đã có Chromium (Notion, HTML), Word, Canva. Chưa thử InDesign, Google Docs thật, PDF có phông Type1 kiểu cũ, file nhiều cột phức tạp.

## Kết luận và đề xuất (ý kiến)

MuPDF.js đạt mục tiêu chất lượng của mức 3 trên ba nguồn phổ biến (Notion, Word, Canva): sửa một dòng không lộ đường sửa, không xê dịch gì xung quanh, file vẫn tìm/copy được. Đủ cơ sở để bắt đầu xây ứng dụng.

Thứ tự đề xuất: (1) giao diện bấm-vào-dòng-để-sửa dùng lõi hiện tại; (2) xử lý gạch chân/gạch ngang; (3) dàn lại đoạn; (4) thứ tự đọc; (5) tích hợp Google Drive; (6) OCR.
