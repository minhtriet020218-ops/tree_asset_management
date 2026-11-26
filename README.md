# Tree Asset Management — Quản lý tài sản IT theo cây vị trí 3D

Hệ thống quản lý tài sản IT (PC, laptop, màn hình, máy in) của nhà máy, hiển thị theo **cây vị trí** (công ty › nhà máy › tầng/xưởng › line) bằng **cây thông 3D** và **mô hình 3D từng tầng**.

## Tính năng chính

- **Cây vị trí + thống kê**: số máy online/offline theo từng tầng/line (cây thông 3D, đốm xanh = online, đỏ = offline).
- **Mô hình 3D từng tầng**: xem/đi bộ góc nhìn thứ nhất, kéo-thả thiết bị vào line.
- **Kho / Line**: thiết bị chưa gán line nằm trong *Kho*; kéo vào line để biên chế (`PATCH /api/assets/:id/placement`).
- **Đồng bộ Active Directory** (domain `xppower.com`): tự lấy danh sách máy, hệ điều hành, lần đăng nhập cuối; bỏ qua máy bị vô hiệu hóa / lâu không đăng nhập (`AD_STALE_DAYS`).
- **Giám sát online/offline** bằng kiểm tra TCP (cổng 445, 135, 3389, 9100, 80, 443) mỗi 5 phút. Trạng thái chỉ do tiến trình này quyết định.
- **Cảnh báo** máy offline qua Microsoft Teams (webhook) và/hoặc email (SMTP).
- **Tự đặt hostname** `{CHI_NHÁNH}{YY}-{LINE}-{STT}` (vd `VN26-F1-001`), số thứ tự cấp nguyên tử ở DB nên không trùng.
- Lịch sử bảo trì, thanh lý (xóa mềm), xuất báo cáo Excel.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Backend | Node.js, Express, PostgreSQL (`pg`), `activedirectory2`, `node-cron`, `nodemailer`, `exceljs` |
| Frontend | React 19, TypeScript, Vite, Three.js, Bootstrap, Chart.js, axios |
| CSDL | PostgreSQL **12 trở lên** |

## Cấu trúc thư mục

```
backend/
  sql/            các script khởi tạo / dữ liệu mẫu (xem bảng bên dưới)
  src/
    server.js     khởi động Express + lịch chạy (cron)
    config/       env.js (đọc .env), db.js
    routes/ controllers/ services/ repositories/
    test/         kiểm thử không cần database
frontend/
  src/            React + Three.js
```

## Yêu cầu cài đặt

- **Node.js 20+** (khuyến nghị bản LTS mới nhất) và npm
- **PostgreSQL 12+** (pgAdmin hoặc `psql` để chạy SQL)
- (Tùy chọn) máy trong mạng nội bộ có thể truy cập Domain Controller nếu muốn đồng bộ AD và giám sát máy thật

## Hướng dẫn chạy từng bước

### Bước 1. Lấy mã nguồn

```bash
git clone <địa-chỉ-repo>
cd tree_asset_management
```

### Bước 2. Tạo database

```sql
CREATE DATABASE tree_asset_management;
```

### Bước 3. Chạy các script SQL (đúng thứ tự)

Mở file trong pgAdmin (Query Tool) hoặc dùng `psql`:

```bash
cd backend/sql
psql -U postgres -d tree_asset_management -v ON_ERROR_STOP=1 -f 000_base_schema.sql
psql -U postgres -d tree_asset_management -v ON_ERROR_STOP=1 -f 001_ad_sync.sql
psql -U postgres -d tree_asset_management -v ON_ERROR_STOP=1 -f 002_real_data.sql
psql -U postgres -d tree_asset_management -v ON_ERROR_STOP=1 -f 006_stock_assignment.sql
psql -U postgres -d tree_asset_management -v ON_ERROR_STOP=1 -f 007_line_order.sql
```

| File | Tác dụng | Bắt buộc? |
|---|---|---|
| `000_base_schema.sql` | Tạo bảng gốc (`tree_nodes`, `assets`, `maintenance_logs`, `hostname_counters`), hàm `next_hostname()` và cây mẫu (Công ty › Tầng 1–4) | Có (DB trống) |
| `001_ad_sync.sql` | Thêm cột/chỉ mục cho đồng bộ AD | Có |
| `002_real_data.sql` | Cột dữ liệu thật (người dùng, mã tài sản, sequence `asset_code_seq`...) | Có |
| `006_stock_assignment.sql` | Quy tắc Kho/Line (cột `in_stock`) | Có |
| `007_line_order.sql` | Thứ tự thiết bị trong line (`line_order`) | Có |
| `003_demo_data.sql` | 50 thiết bị mẫu + 40 màn hình (hostname `DEMO-...`) | Tùy chọn |
| `005_demo_sketch_lines.sql` | 8 line mẫu theo bản vẽ tay, 59 tài sản | Tùy chọn |
| `009_cleanup_demo.sql` | Xóa dữ liệu mẫu | Tùy chọn |
| `010_wipe_all_assets.sql` | **Xóa TOÀN BỘ tài sản** để đồng bộ lại từ AD | Cẩn thận |

> Nếu bạn đã có database chạy sẵn thì **bỏ qua `000`**. `000` an toàn khi chạy lại.
> Muốn thử nhanh giao diện: chạy thêm `005_demo_sketch_lines.sql`.
> **Sao lưu database** (`pg_dump`) trước khi chạy `009` / `010`.
> Lưu ý: `009_cleanup_demo.sql` có đoạn dùng cột `is_demo`; nếu DB của bạn chưa có cột này, đoạn đó báo lỗi nhưng phần xóa máy `DEMO-` phía trước đã chạy xong.

### Bước 4. Cấu hình backend

```bash
cd backend
npm install
```

Tạo file `backend/.env` (**không commit file này lên git**):

```ini
# --- Bắt buộc ---
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tree_asset_management
DB_USER=postgres
DB_PASSWORD=<mật-khẩu-postgres>

# --- Server ---
PORT=8080
# Địa chỉ frontend được phép gọi API (Vite mặc định là 5173)
CORS_ORIGINS=http://localhost:5173

# --- Active Directory (tùy chọn; thiếu 1 biến thì tắt đồng bộ AD) ---
# AD_URL=ldaps://VNAD.xppower.com
# AD_BASE_DN=OU=Vietnam,OU=Asia_Computers,OU=XPPOWER_Computers,DC=xppower,DC=com
# AD_SERVICE_USER=<tài-khoản-đọc-AD>
# AD_SERVICE_PASSWORD=<mật-khẩu>
# AD_DEFAULT_NODE_ID=1          # node (id) chứa máy mới lấy từ AD
# AD_CA_FILE=C:\certs\ca.pem    # CA nội bộ nếu Node không tin chứng chỉ LDAPS
# AD_TLS_INSECURE=true          # CHỈ để thử, không dùng khi chạy thật
# AD_SYNC_ON_START=true         # đồng bộ ngay khi khởi động
# AD_STALE_DAYS=90              # bỏ qua máy không đăng nhập quá N ngày (0 = chỉ bỏ máy bị vô hiệu)

# --- Giám sát online/offline (có giá trị mặc định) ---
# STATUS_CRON=*/5 * * * *       # mỗi 5 phút
# SYNC_AD_CRON=0 2 * * *        # 2h sáng mỗi ngày
# PROBE_PORTS=445,135,3389,9100,80,443
# PROBE_TIMEOUT_MS=2000
# OFFLINE_AFTER_FAILS=2
# HOST_DNS_SUFFIX=xppower.com

# --- Cảnh báo (tùy chọn) ---
# TEAMS_WEBHOOK_URL=<url-webhook-teams>     # URL có chữ ký, giữ bí mật
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=<user>
# SMTP_PASSWORD=<password>
# ALERT_EMAIL_FROM=it-alert@example.com
# ALERT_EMAIL_TO=a@example.com,b@example.com
# ALERT_OFFLINE_MINUTES=60      # offline bao lâu thì báo
# ALERT_REPEAT_HOURS=24         # nhắc lại sau X giờ (0 = không nhắc)
# NEW_ASSET_GRACE_DAYS=7        # máy tạo tay được tắt cảnh báo N ngày
```

### Bước 5. Chạy backend

```bash
cd backend
npm start        # chạy thật (đã bật --use-system-ca cho LDAPS)
# hoặc
npm run dev      # tự khởi động lại khi sửa code (nodemon)
```

Kiểm tra: mở `http://localhost:8080/api/tree` — trả về JSON là backend đã chạy.

### Bước 6. Chạy frontend

Mở terminal **khác**:

```bash
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5173`. Frontend gọi API tại `http://localhost:8080/api` (mặc định). Nếu backend chạy cổng/máy khác, tạo `frontend/.env`:

```ini
VITE_API_URL=http://<máy-backend>:<cổng>/api
```

### Bước 7. (Tùy chọn) Đồng bộ AD và kiểm tra trạng thái thủ công

```powershell
Invoke-RestMethod -Method Post http://localhost:8080/api/sync/ad
Invoke-RestMethod -Method Post http://localhost:8080/api/sync/status
Invoke-RestMethod http://localhost:8080/api/sync          # kết quả lần chạy gần nhất
Invoke-RestMethod -Method Post http://localhost:8080/api/sync/alerts/test   # gửi tin thử Teams/email
```

(Linux/macOS: dùng `curl -X POST http://localhost:8080/api/sync/ad`.)

### Bước 8. Build production

```bash
cd frontend
npm run build      # tsc -b && vite build, kết quả ở frontend/dist
npm run preview    # xem thử bản build
```

### Chạy kiểm thử backend

```bash
cd backend
node --test src/test      # không cần database
```

## API chính

| Nhóm | Endpoint |
|---|---|
| Cây | `GET /api/tree`, `GET /api/tree/stats`, `POST /api/tree` |
| Tài sản | `GET/POST /api/assets`, `PUT/DELETE /api/assets/:id`, `GET /api/assets/meta`, `GET /api/assets/stock`, `GET /api/assets/dashboard/stats`, `PATCH /api/assets/:id/placement` |
| Bảo trì | `GET/POST /api/assets/:id/maintenance`, `DELETE /api/assets/:id/maintenance/:logId` |
| Báo cáo | `GET /api/reports/export` (Excel) |
| Đồng bộ | `GET /api/sync`, `POST /api/sync/ad`, `POST /api/sync/status`, `POST /api/sync/alerts/test` |

## Quy tắc nghiệp vụ cần biết

- **Trạng thái** chỉ có `online` / `offline`, do tiến trình kiểm tra TCP quyết định; offline sau `OFFLINE_AFTER_FAILS` lần liên tiếp thất bại. Không sửa tay trên form.
- **Kho**: thiết bị chưa có vị trí hoặc line trống thì nằm trong Kho.
- Máy lấy từ AD được thêm với trạng thái `offline` cho tới lần kiểm tra đầu tiên. Đồng bộ AD **chỉ cập nhật cột lấy từ AD**, không ghi đè dữ liệu nhập tay.
- Mã tài sản IT (`VN-10001`...) do hệ thống tự cấp trong DB, **không** nằm trong AD.
- Máy thanh lý (xóa mềm), máy mẫu (`is_demo`) và máy đang tắt cảnh báo không bị giám sát/cảnh báo.

## Xử lý lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `Thiếu biến môi trường: DB_...` | Chưa có `backend/.env` hoặc thiếu biến bắt buộc |
| `Unable to connect to the remote server` khi gọi API | Backend chưa chạy hoặc sai cổng (mặc định **8080**) |
| Frontend báo lỗi CORS / Network Error | Thêm địa chỉ frontend vào `CORS_ORIGINS` rồi khởi động lại backend |
| Không kết nối được DB | Kiểm tra PostgreSQL đang chạy, `DB_HOST/PORT/USER/PASSWORD` |
| `relation "assets" does not exist` | Chưa chạy `000_base_schema.sql` (hoặc các file SQL theo thứ tự) |
| LDAPS lỗi chứng chỉ (`unable to verify...`) | Chạy bằng `npm start` (đã dùng chứng chỉ hệ thống), hoặc đặt `AD_CA_FILE`; chỉ để thử mới dùng `AD_TLS_INSECURE=true` |
| LDAPS lỗi sai tên máy chủ | `AD_URL` phải đúng tên trong chứng chỉ (vd `ldaps://VNAD.xppower.com`) |
| Đồng bộ AD không chạy | Thiếu 1 trong `AD_URL`, `AD_BASE_DN`, `AD_SERVICE_USER`, `AD_SERVICE_PASSWORD` |
| Đồng bộ ra nhiều máy hơn dự kiến | Gồm máy lâu không đăng nhập/vô hiệu hóa; chỉnh `AD_STALE_DAYS` hoặc thu hẹp `AD_BASE_DN` |
| Nhiều máy hiện offline | Máy tắt (cuối tuần/ngoài giờ) hoặc backend không tới được mạng của máy; kiểm tra lại trong giờ làm việc |
| Màn hình 3D đen | Chọn đúng tầng có thiết bị, bấm nút Iso/Top để đưa camera lại, mở F12 › Console xem lỗi |

## Bảo mật

- Không commit `.env`, mật khẩu tài khoản AD, URL webhook Teams (có chữ ký bí mật), file `.pfx`/`.key`.
- `AD_TLS_INSECURE=true` chỉ dùng thử.
- Dùng tài khoản AD chỉ-đọc cho đồng bộ.

## Ghi chú về trang trí cây thông

`ThreePineTree` vẽ đốm sáng xanh/đỏ theo số máy online/offline từng tầng (tối đa 220 đốm mỗi tầng, mỗi đốm đại diện nhiều máy khi vượt ngưỡng), tuyết rơi và khối lập phương logo thay cho ngôi sao.
