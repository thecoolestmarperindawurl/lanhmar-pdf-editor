# Bật trang web, gắn tên miền pdf.lanhmar.id.vn và kết nối Google Drive

Hướng dẫn cho người không chuyên. Làm theo thứ tự; mỗi bước ghi **vào đâu → bấm gì → thấy gì là đúng**. Không tốn phí.

## Bước 1 · Bật GitHub Pages (2 phút)

1. Mở `https://github.com/thecoolestmarperindawurl/lanhmar-pdf-editor/settings/pages`
2. **Source**: chọn **Deploy from a branch**. **Branch**: `main`, thư mục `/ (root)` → **Save**.
3. Chờ 1–2 phút, tải lại trang. Ở đầu trang hiện “Your site is live at `https://thecoolestmarperindawurl.github.io/lanhmar-pdf-editor/`”.
4. Mở địa chỉ đó, bấm **Thử với file mẫu**, bấm vào một dòng và sửa thử.

## Bước 2 · Gắn tên miền pdf.lanhmar.id.vn (5 phút + chờ DNS)

Làm bước 2a **trước** 2b, nếu không trang sẽ tạm không vào được.

**2a. Thêm bản ghi DNS** ở nơi quản lý tên miền lanhmar.id.vn (chỗ bạn đã thêm bản ghi TXT lần trước):

| Trường | Giá trị |
|---|---|
| Loại / Type | `CNAME` |
| Tên / Host | `pdf` |
| Giá trị / Target | `thecoolestmarperindawurl.github.io` (có hoặc không có dấu chấm cuối tuỳ giao diện) |
| TTL | mặc định |

Chờ 10–60 phút để DNS lan truyền.

**2b. Khai báo trong GitHub:** quay lại trang Pages ở Bước 1 → ô **Custom domain** gõ `pdf.lanhmar.id.vn` → **Save**. GitHub kiểm tra DNS (dấu tích xanh “DNS check successful”), rồi cấp chứng chỉ HTTPS (có thể mất tới 1 giờ). Khi ô **Enforce HTTPS** bấm được thì tích vào.

GitHub tự tạo file `CNAME` trong repo; địa chỉ github.io cũ tự chuyển sang `https://pdf.lanhmar.id.vn`.

## Bước 3 · Tạo OAuth Client cho trang web (5 phút)

Extension dùng client loại “Chrome Extension”; trang web cần thêm một client loại “Web application” **trong cùng project** (`313294325944`).

1. Mở `https://console.cloud.google.com/auth/clients/create` (kiểm tra ô project ở thanh trên đúng là project của Drive Ebook Reader).
2. **Application type**: **Web application**. **Name**: `LANHMAR PDF Editor`.
3. **Authorized JavaScript origins** → **Add URI** hai lần:
   - `https://thecoolestmarperindawurl.github.io`
   - `https://pdf.lanhmar.id.vn`
4. **Authorized redirect URIs**: để trống. Bấm **Create**.
5. Copy **Client ID** (dạng `313294325944-xxxx.apps.googleusercontent.com`) và gửi cho mình.

## Bước 4 · Cho API key của Picker dùng được trên trang mới (2 phút)

1. Mở `https://console.cloud.google.com/apis/credentials`, bấm vào API key `ebook-reader`.
2. Mục **Website restrictions** → **Add** thêm hai dòng (giữ dòng `https://lanhmar.id.vn/*` cũ):
   - `https://thecoolestmarperindawurl.github.io/*`
   - `https://pdf.lanhmar.id.vn/*`
3. **Save**.

## Sau khi mình nhận Client ID

Mình điền vào `app/config.js`, đưa lên, rồi bạn thử:
- Trang chủ có nút **Mở từ Google Drive** → đăng nhập → chọn PDF → sửa → **Lưu vào Drive** (tạo bản “(đã sửa)” cạnh file gốc).
- Trong extension Drive Ebook Reader, nút **Sửa PDF này** mở thẳng file đang đọc vào trình sửa.

Nếu lần đầu Google bắt chọn lại file trong cửa sổ Picker: đó là cơ chế quyền `drive.file` (trang chỉ thấy file bạn tự chọn), chọn một lần là xong.
