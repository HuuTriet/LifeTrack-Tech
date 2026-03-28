# LifeTrack Tech — Edge Extension

Extension nhắc uống thuốc cho Microsoft Edge.

## Tính năng
- Đăng nhập bằng tài khoản LifeTrack (ELDERLY)
- Hiển thị lịch uống thuốc hôm nay trong popup
- Badge icon hiển thị số thuốc chưa uống
- Thông báo tự động khi đến giờ uống thuốc (mỗi phút kiểm tra 1 lần)
- Cảnh báo khi quá giờ uống thuốc
- Nút "Đã uống" ngay trong popup
- Click thông báo → mở trang Thuốc trong app

## Cách cài đặt

### Bước 1: Tạo icons
1. Mở file `generate-icons.html` trong trình duyệt
2. Download 3 file: `icon16.png`, `icon48.png`, `icon128.png`
3. Đặt vào thư mục `icons/`

### Bước 2: Load extension vào Edge
1. Mở Edge → `edge://extensions`
2. Bật **Developer mode** (góc dưới bên trái)
3. Nhấn **Load unpacked**
4. Chọn thư mục `edge-extension/`
5. Extension xuất hiện trên thanh công cụ

### Bước 3: Sử dụng
1. Backend phải đang chạy ở `http://localhost:3000`
2. Click icon extension → Đăng nhập với tài khoản ELDERLY
3. Extension sẽ tự động nhắc nhở mỗi phút

## Cấu trúc
```
edge-extension/
├── manifest.json       # Cấu hình extension (Manifest V3)
├── background.js       # Service worker — polling + notifications
├── popup.html          # Giao diện popup
├── popup.js            # Logic popup
├── generate-icons.html # Công cụ tạo icons
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
