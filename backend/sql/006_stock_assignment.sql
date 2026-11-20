-- Hybrid workflow: Kho (Stock) + tự động gán Line.
--
-- Quy tắc duy nhất, dùng chung cho API, sơ đồ 3D và bảng kiểm kê:
--   thiết bị ĐÃ ĐƯỢC BIÊN CHẾ vào line  <=>  có node_id VÀ có production_line
--   thiết bị trong KHO (in_stock = true) <=>  thiếu node_id HOẶC production_line để trống
--
-- Máy từ AD đổ về (chưa có production_line) và thiết bị mới mua (chưa chọn vị trí) vì vậy tự nằm trong Kho.
-- Thiết bị tạo từ form mà điền đủ node + Line thì vào thẳng line, không cần kéo thả.
-- Cột tự tính từ 2 cột kia nên không bao giờ lệch dữ liệu. Cần PostgreSQL 12 trở lên.
BEGIN;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS in_stock boolean
  GENERATED ALWAYS AS (node_id IS NULL OR btrim(coalesce(production_line, '')) = '') STORED;

CREATE INDEX IF NOT EXISTS assets_in_stock_idx ON assets (id DESC) WHERE in_stock;

COMMIT;

-- Kiểm tra: số thiết bị trong kho / đã vào line
--   SELECT in_stock, COUNT(*) FROM assets GROUP BY 1;
