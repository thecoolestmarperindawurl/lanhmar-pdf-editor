# Nhận định sau lượt thử đầu (10/11/2026)

Dữ liệu: 6 PDF tiếng Việt tổng hợp do Chromium xuất, 11 ca sửa. Bảng chi tiết và ảnh: [`report/REPORT.md`](report/REPORT.md).

## Đã kiểm chứng (đo được)

| Kết quả | Số liệu |
|---|---|
| Ca đạt đủ 6 tiêu chí | 10/11 |
| Ca không sửa được | 1, bản scan không có lớp chữ (đúng dự kiến) |
| Điểm ảnh đổi ngoài vùng sửa | 0 ở cả 10 ca (cả trang có 3.000–11.000 điểm đổi, đều nằm trong vùng sửa) |
| Chữ mới đọc được bằng MuPDF và pdf.js | 10/10 |
| Chữ cũ còn sót trong lớp chữ | 0/10 |
| Ca phải co ngang chữ | 3/10: 99%, 89%, 87% |
| Dung lượng lõi WASM khi tải trên web | 10,4 MB gốc · 4,7 MB nén gzip · 3,6 MB nén brotli |

Phông được chọn theo từng tình huống:

| Tình huống | Cách chọn | Đánh giá bằng mắt |
|---|---|---|
| Mọi ký tự mới đã có trong phông nhúng | Dùng lại phông gốc | Không phân biệt được |
| Thiếu ký tự (vd. “ỹ”, chữ số mới), phông Times/Arial/Calibri | Phông cùng họ đo bằng (Liberation, Carlito) | Không phân biệt được |
| Phông Type3 không tên (Chromium xuất từ phông OTF) | So độ rộng ký tự: nhận đúng Inter thường / Inter đậm, lệch 0,6–1,4% | Không phân biệt được |
| Phông lạ không có trong bộ (FreeSerif) | So độ rộng: chọn Liberation Serif, lệch 2,4%/ký tự | Gần giống, mắt tinh thấy khác nhẹ |

## Hạn chế còn lại (cần làm tiếp)

1. **Chữ dài hơn trong đoạn căn đều bị co ngang** (87–89%): vừa chỗ nhưng nhìn kỹ thấy chữ hẹp hơn dòng trên dưới. Cần **dàn lại cả đoạn** (đẩy chữ thừa xuống dòng sau) thay vì chỉ viết lại một dòng.
2. **Thứ tự đọc**: chữ mới được ghi ở cuối nội dung trang, nên khi copy cả trang hoặc dùng trình đọc màn hình, cụm vừa sửa xuất hiện cuối cùng (thấy rõ ở ca ô bảng). Cần chèn chữ mới đúng chỗ trong luồng nội dung.
3. **Bản scan** cần nhận dạng chữ (OCR) trước khi sửa; chưa làm. Phương án miễn phí trong trình duyệt: Tesseract.js (cần kiểm chứng chất lượng với tiếng Việt).
4. **Chỉ sửa trong một dòng**; cụm chữ vắt qua hai dòng chưa hỗ trợ.
5. **Mẫu tổng hợp** do cùng một công cụ (Chromium) xuất. PDF từ Word, InDesign, Canva thật có thể nhúng phông khác (Type1, TrueType mã hoá riêng) và chưa được thử. **Đây là rủi ro lớn nhất còn lại.**

## Ý kiến (chưa kiểm chứng)

- Với bộ phông dự phòng hiện tại, tài liệu văn phòng (Times, Arial, Calibri) có triển vọng tốt nhất. Bộ phông cần mở rộng cho tài liệu thiết kế: các phông Google phổ biến có dấu tiếng Việt như Be Vietnam Pro, Montserrat, Roboto, Noto Sans/Serif, Lora, Merriweather (đều giấy phép OFL, nhúng hợp lệ).
- Nếu bộ PDF thật cho kết quả tương tự, MuPDF.js đủ tốt để xây ứng dụng. Bước tiếp theo theo thứ tự ưu tiên: dàn lại đoạn → thứ tự đọc → giao diện bấm-để-sửa → tích hợp Google Drive.
