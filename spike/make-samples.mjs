// Sinh bộ PDF mẫu tiếng Việt bằng Chromium (Playwright). Chromium nhúng phông dạng tập con (subset) giống Word/Google Docs/Canva,
// nên đây là phép thử thực tế cho bài toán "phông gốc thiếu ký tự".
// Cần Playwright: `npm i -D playwright` (hoặc dùng bản cài sẵn). File PDF sinh ra đã được commit, chỉ chạy lại khi đổi mẫu.
// Mẫu s4 dùng FreeSerif của hệ thống (/usr/share/fonts/truetype/freefont) để giả lập "phông lạ không có trong bộ dự phòng".
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.resolve(HERE, '../fonts');
const OUT = path.join(HERE, 'samples');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'lmpdf-'));
const ff = (fam, file, w = 400) => `@font-face{font-family:'${fam}';src:url('file://${file}');font-weight:${w}}`;

const S = {
  's1-word-times': {
    font: ff('Doc', `${FONTS}/LiberationSerif-Regular.ttf`) + ff('Doc', `${FONTS}/LiberationSerif-Bold.ttf`, 700),
    css: 'body{font-family:Doc;font-size:12pt;line-height:1.5;text-align:justify;margin:0} h1{font-size:16pt;text-align:center;margin:0 0 14pt}',
    body: `<h1>BÁO CÁO KẾT QUẢ KINH DOANH QUÝ 3</h1>
<p>12,5 tỷ đồng là doanh thu của công ty trong quý 3 năm 2026, tăng 18% so với cùng kỳ năm trước. Chi phí quảng cáo trên các nền tảng mạng xã hội chiếm 32% tổng ngân sách marketing, giảm nhẹ so với quý 2.</p>
<p>Đội ngũ bán hàng đã mở thêm hai cửa hàng tại Đà Nẵng và Cần Thơ. Tỉ lệ khách hàng quay lại đạt 41%, là mức cao nhất từ trước đến nay.</p>`,
    margin: '2.5cm',
  },
  's2-gdocs-arial': {
    font: ff('Doc', `${FONTS}/LiberationSans-Regular.ttf`) + ff('Doc', `${FONTS}/LiberationSans-Bold.ttf`, 700),
    css: 'body{font-family:Doc;font-size:11pt;line-height:1.4;margin:0} h2{font-size:15pt;margin:0 0 10pt} table{border-collapse:collapse;margin-top:12pt} td,th{border:1px solid #999;padding:6pt 12pt;text-align:left;width:120pt}',
    body: `<h2>Kế hoạch nội dung tháng 11</h2>
<p>Mục tiêu chính là đưa lượt theo dõi trang lên 20.000 người và duy trì tỉ lệ tương tác trên 5%.</p>
<table><tr><th>Kênh</th><th>Ngân sách</th><th>Số bài</th></tr>
<tr><td>Facebook</td><td>15 triệu</td><td>24</td></tr>
<tr><td>TikTok</td><td>20 triệu</td><td>30</td></tr>
<tr><td>Email</td><td>5 triệu</td><td>8</td></tr></table>`,
    margin: '2cm',
  },
  's3-calibri-2col': {
    font: ff('Doc', `${FONTS}/Carlito-Regular.ttf`) + ff('Doc', `${FONTS}/Carlito-Bold.ttf`, 700),
    css: 'body{font-family:Doc;font-size:11pt;line-height:1.45;margin:0} h2{font-size:14pt;margin:0 0 8pt} .cols{columns:2;column-gap:24pt;text-align:left}',
    body: `<h2>Bản tin học tập tuần 45</h2><div class="cols">
<p>ba nguyên tắc giúp nhóm làm việc cùng AI hiệu quả: giao việc rõ ràng, có bước kiểm tra, và người chịu trách nhiệm cuối cùng. Mỗi nguyên tắc đi kèm một bài tập nhỏ để cả lớp thực hành ngay trong buổi học.</p>
<p>Học viên chia thành nhóm bốn người, mỗi nhóm chọn một quy trình thật của doanh nghiệp để thử nghiệm và trình bày kết quả.</p>
<p>Tuần sau lớp sẽ học cách đo lường hiệu quả, so sánh thời gian làm việc trước và sau khi dùng AI, rồi viết báo cáo một trang.</p>
<p>Mọi câu hỏi gửi vào nhóm chung, trợ giảng trả lời trong vòng một ngày làm việc.</p></div>`,
    margin: '2cm',
  },
  's4-unknown-serif': {
    font: ff('Doc', '/usr/share/fonts/truetype/freefont/FreeSerif.ttf'),
    css: 'body{font-family:Doc;font-size:13pt;line-height:1.5;margin:0}',
    body: `<p>Điều 3. Hai bên thống nhất rằng hợp đồng này có hiệu lực từ ngày ký và được lập thành hai bản có giá trị như nhau.</p>
<p>Mọi thay đổi phải được lập thành văn bản và có chữ ký của đại diện hai bên.</p>`,
    margin: '2.5cm',
  },
  's5-slide-inter': {
    font: ff('Doc', `${FONTS}/Inter-Regular.otf`) + ff('Doc', `${FONTS}/Inter-Bold.otf`, 700),
    css: 'body{font-family:Doc;margin:0;background:#2D2FEF;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact} .s{width:1280px;height:720px;padding:80px;box-sizing:border-box} h1{font-size:64px;margin:0 0 40px} li{font-size:36px;margin:12px 0;color:#FFD9C9}',
    body: `<div class="s"><h1>Chiến lược nội dung 2027</h1><ul><li>Tăng 30% lượt xem video ngắn</li><li>Mỗi tuần hai bài phân tích chuyên sâu</li></ul></div>`,
    page: { width: '1280px', height: '720px' }, margin: '0',
  },
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [id, s] of Object.entries(S)) {
  const html = `<!doctype html><meta charset="utf-8"><style>${s.font}${s.css}</style>${s.body}`;
  const f = path.join(TMP, id + '.html'); fs.writeFileSync(f, html);
  await page.goto('file://' + f); await page.evaluate(() => document.fonts.ready);
  const opt = s.page ? { ...s.page, printBackground: true } : { format: 'A4', printBackground: true, margin: { top: s.margin, bottom: s.margin, left: s.margin, right: s.margin } };
  await page.pdf({ path: path.join(OUT, id + '.pdf'), ...opt });
  console.log('✓', id);
}
// s6: bản scan (chỉ có ảnh, không có lớp chữ) dựng từ ảnh chụp mẫu s1
{
  const f = path.join(TMP, 's1-word-times.html');
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.goto('file://' + f); await page.addStyleTag({ content: 'body{padding:94px}' });
  const png = await page.screenshot({ fullPage: false });
  const html = `<!doctype html><style>body{margin:0}img{width:100%;display:block}</style><img src="data:image/png;base64,${png.toString('base64')}">`;
  const g = path.join(TMP, 'scan.html'); fs.writeFileSync(g, html);
  await page.goto('file://' + g);
  await page.pdf({ path: path.join(OUT, 's6-scan.pdf'), format: 'A4', margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  console.log('✓ s6-scan');
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
