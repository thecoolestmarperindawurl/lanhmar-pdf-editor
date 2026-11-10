# Spike: thử chất lượng sửa chữ gốc

## Chạy

```bash
npm install
npm run spike
```

Kết quả: `report/REPORT.md` (bảng 6 tiêu chí + ảnh trước/sau), `report/results.json`, PDF đã sửa trong `out/` (không commit).

## Kiểm thử diện rộng

```bash
npm run fuzz            # sửa mọi dòng của mẫu tổng hợp theo 5 kiểu
npm run fuzz -- --real  # như trên với PDF thật
npm run multi -- --real # sửa liên tiếp nhiều dòng, kiểm dòng sửa trước không hỏng
```

## Sáu tiêu chí cho mỗi ca

1. Đọc đúng chữ có dấu trong file gốc.
2. Chữ cũ bị xoá khỏi lớp chữ (tìm/copy không còn thấy).
3. Chữ mới đọc được bằng MuPDF.
4. Chữ mới đọc được bằng pdf.js (trình đọc độc lập, dùng trong Firefox và extension Drive Ebook Reader).
5. Không có điểm ảnh nào đổi ngoài vùng sửa (bố cục xung quanh giữ nguyên).
6. Không tràn: chữ mới vừa chỗ, co ngang tối đa 85%.

Độ giống phông bằng mắt: xem ảnh trước/sau trong báo cáo. Đừng chỉ tin bảng.

## Thêm PDF thật

1. Chép PDF vào `samples/real/` (thư mục này không được commit).
2. Tạo `samples/real/cases.json` cùng cấu trúc `samples/cases.json`: mỗi file một khoá (tên file không đuôi), `expect` là vài cụm chữ có dấu chắc chắn có trong trang 1, `cases` là các cặp `find` → `replace` nằm trên **một dòng** của trang 1.
3. `node spike/run.mjs --real` → báo cáo ở `report-real/` (không commit).

## Sinh lại mẫu tổng hợp

Cần Playwright (`npm i -D playwright`) và phông FreeSerif của hệ thống cho mẫu s4: `npm run spike:samples`.
