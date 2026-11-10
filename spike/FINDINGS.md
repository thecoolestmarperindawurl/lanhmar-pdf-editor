# Nhận định sau hai lượt thử (10/11/2026)

## Dữ liệu thử

| Bộ | Nguồn | Số file | Số ca sửa |
|---|---|---|---|
| Tổng hợp | Chromium xuất từ HTML: Times, Arial + bảng, Calibri hai cột, phông lạ, slide Inter, bản scan | 6 | 11 |
| **Thật** | 5 bài giảng quản lý dự án, **Notion xuất PDF** (Headless Chrome 128), 12–21 trang, 3,7–9 MB | 5 | 14 |

Bộ thật không đưa lên repo (tài liệu khoá học). Báo cáo của bộ thật nằm ở `spike/report-real/` trên máy chạy thử, không commit. Bảng và ảnh của bộ tổng hợp: [`report/REPORT.md`](report/REPORT.md).

## Kết quả đo được

| Chỉ số | Tổng hợp | Thật |
|---|---|---|
| Ca đạt đủ 6 tiêu chí tự động | 10/11 | **14/14** |
| Điểm ảnh đổi ngoài vùng sửa | 0 ở mọi ca | 0 ở mọi ca |
| Chữ mới đọc được bằng MuPDF và pdf.js | 10/10 | 14/14 |
| Chữ cũ còn sót trong lớp chữ | 0 | 0 |
| Ca phải co ngang chữ | 3 (87–99%) | 0 |
| Trích chữ tiếng Việt đúng dấu từ file gốc | 5/6 file (trừ bản scan) | 5/5 file |
| Dung lượng lõi WASM khi tải trên web | 10,4 MB gốc · 4,7 MB gzip · 3,6 MB brotli | |

Ca không đạt duy nhất là bản scan, không có lớp chữ, đúng dự kiến.

## Điều bộ thật dạy thêm (bộ tổng hợp không bắt được)

PDF xuất từ Notion gần như toàn bộ là **phông Type3 không tên**, bị Chrome chia vụn thành hàng chục phông con, mỗi cái vài ký tự. Ba lỗi lộ ra khi xem ảnh, dù bảng tự động vẫn báo "đạt":

1. **Mất độ đậm vừa**: tiêu đề Notion là Inter SemiBold. Bộ phông chỉ có Regular/Bold nên tiêu đề sửa xong thành chữ thường. → Thêm Inter Medium và SemiBold.
2. **Độ rộng ký tự không đủ để phân biệt độ đậm** (Inter các độ đậm có độ rộng gần nhau). → Chọn độ đậm bằng **lượng mực**: vẽ lại đúng các ký tự gốc bằng từng độ đậm ứng viên tại đúng vị trí, so lượng điểm tối với bản gốc. Lệch còn 0–4,6% (một ca chữ xám mục lục lệch 28% nhưng vẫn chọn đúng Regular).
3. **Dòng trộn thường/đậm** ("Nên áp dụng cho nhóm **3-5 người trở lên**.") bị in đậm cả câu. → Giữ kiểu chữ **theo từng ký tự**: phần giống nhau ở đầu/cuối giữ kiểu gốc, phần mới lấy kiểu của chữ nó thay thế, đuôi dòng giữ kiểu gốc. Kết quả: "nhóm **từ 4 người trở lên**".

Thêm: chốt **một họ phông cho cả trang** (gộp số đo mọi phông Type3) để tránh dòng bị trộn hai họ; chữ số đứng lẻ mượn độ đậm của ký tự gần nhất đo được.

Kết quả bằng mắt trên bộ thật: tiêu đề bìa 30pt, tiêu đề cấp 2–3, thân bài, chữ xám mục lục, dòng có emoji ✅, ngoặc kép cong, dòng trộn đậm/thường đều **không phân biệt được chỗ sửa**. Có cả một lỗi chính tả thật trong tài liệu được sửa: “TỔNG LẾT” → “TỔNG KẾT”.

## Hạn chế còn lại (thứ tự ưu tiên)

1. **Trang trí vẽ rời khỏi chữ** (gạch chân link mục lục Notion, gạch ngang, nền tô): không đổi theo độ dài chữ mới. Thấy ở ca rút ngắn mục lục: gạch chân dài hơn chữ. Cần nhận diện nét ngang ngay dưới chữ và co/giãn theo.
2. **Chữ dài hơn trong đoạn căn đều bị co ngang** (87–89% ở bộ tổng hợp). Cần dàn lại cả đoạn.
3. **Thứ tự đọc**: chữ mới ghi ở cuối luồng nội dung, copy cả trang thì cụm vừa sửa nằm cuối.
4. **Chỉ sửa trong một dòng**; cụm vắt hai dòng chưa hỗ trợ.
5. **Bản scan** cần OCR (chưa làm; ứng viên miễn phí: Tesseract.js, cần kiểm chứng với tiếng Việt).
6. **Chữ nghiêng** của phông Type3 chưa nhận dạng được (đang mặc định chữ đứng).
7. **Độ phủ nguồn**: mới có PDF từ Chromium (Notion, HTML). Word, InDesign, Canva thật vẫn chưa thử.

## Kết luận và đề xuất (ý kiến)

MuPDF.js đạt mục tiêu chất lượng của mức 3 trên cả hai bộ: sửa một dòng không lộ đường sửa, không xê dịch gì xung quanh, file vẫn tìm/copy được. Đủ cơ sở để bắt đầu xây ứng dụng, song song bổ sung mẫu Word/Canva.

Thứ tự đề xuất: (1) giao diện bấm-vào-dòng-để-sửa dùng lõi hiện tại; (2) xử lý gạch chân/gạch ngang; (3) dàn lại đoạn; (4) thứ tự đọc; (5) tích hợp Google Drive; (6) OCR.
