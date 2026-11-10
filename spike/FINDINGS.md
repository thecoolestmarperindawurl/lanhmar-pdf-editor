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

## Hạn chế còn lại (thứ tự ưu tiên)

1. **Trang trí vẽ rời khỏi chữ** (gạch chân link mục lục Notion, gạch ngang, nền tô): không đổi theo độ dài chữ mới. Thấy ở ca rút ngắn mục lục: gạch chân dài hơn chữ. Cần nhận diện nét ngang ngay dưới chữ và co/giãn theo.
2. **Chữ dài hơn trong đoạn căn đều bị co ngang** (87–89% ở bộ tổng hợp). Cần dàn lại cả đoạn.
3. **Thứ tự đọc**: chữ mới ghi ở cuối luồng nội dung, copy cả trang thì cụm vừa sửa nằm cuối.
4. **Chỉ sửa trong một dòng**; cụm vắt hai dòng chưa hỗ trợ.
5. **Bản scan** cần OCR (chưa làm; ứng viên miễn phí: Tesseract.js, cần kiểm chứng với tiếng Việt).
6. **Chữ nghiêng** của phông Type3 chưa nhận dạng được (đang mặc định chữ đứng).
7. **Độ phủ nguồn**: đã có Chromium (Notion, HTML), Word, Canva. Chưa thử InDesign, Google Docs thật, PDF có phông Type1 kiểu cũ, file nhiều cột phức tạp.

## Kết luận và đề xuất (ý kiến)

MuPDF.js đạt mục tiêu chất lượng của mức 3 trên ba nguồn phổ biến (Notion, Word, Canva): sửa một dòng không lộ đường sửa, không xê dịch gì xung quanh, file vẫn tìm/copy được. Đủ cơ sở để bắt đầu xây ứng dụng.

Thứ tự đề xuất: (1) giao diện bấm-vào-dòng-để-sửa dùng lõi hiện tại; (2) xử lý gạch chân/gạch ngang; (3) dàn lại đoạn; (4) thứ tự đọc; (5) tích hợp Google Drive; (6) OCR.
