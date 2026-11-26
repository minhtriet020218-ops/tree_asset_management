-- BẢNG GỐC của hệ thống. Chạy ĐẦU TIÊN trên database trống (trước 001_ad_sync.sql).
-- Tạo: tree_nodes (cây vị trí), assets (thiết bị), maintenance_logs (lịch sử bảo trì),
--      hostname_counters + hàm next_hostname() (cấp tên máy tự động), sequence asset_code_seq.
-- An toàn khi chạy lại (IF NOT EXISTS / OR REPLACE). Cần PostgreSQL 12 trở lên.
--
-- Nếu bạn đã có database chạy sẵn từ trước thì KHÔNG cần chạy file này.

BEGIN;

-- ===== Cây vị trí: công ty > nhà máy > tầng / xưởng > line =====
CREATE TABLE IF NOT EXISTS tree_nodes (
  id          bigserial PRIMARY KEY,
  parent_id   bigint REFERENCES tree_nodes(id) ON DELETE SET NULL,
  name        text NOT NULL,
  code        text,          -- mã ngắn dùng đặt hostname (vd: VN, SMT01)
  node_type   text,          -- company | plant | workshop | line ...
  description text
);
CREATE INDEX IF NOT EXISTS tree_nodes_parent_idx ON tree_nodes (parent_id);

-- ===== Thiết bị =====
-- Các cột bổ sung (AD, người dùng, Kho, thứ tự trong line...) do 001, 002, 006, 007 thêm vào.
CREATE TABLE IF NOT EXISTS assets (
  id                  bigserial PRIMARY KEY,
  node_id             bigint NOT NULL REFERENCES tree_nodes(id),
  it_asset_code       text,
  hostname            text NOT NULL,
  category            text,
  product             text,
  production_line     text,
  finance_asset_code  text,
  po_invoice          text,
  serial_number       text,
  mac_address         text,
  status              text NOT NULL DEFAULT 'offline',   -- chỉ 'online' | 'offline', do tiến trình kiểm tra mạng quyết định
  last_seen_at        timestamptz,
  liquidated_at       timestamptz,                       -- có giá trị = đã thanh lý (xóa mềm)
  alerts_muted_until  timestamptz,
  offline_since       timestamptz,
  offline_alerted_at  timestamptz
);

-- ===== Lịch sử bảo trì =====
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id           bigserial PRIMARY KEY,
  asset_id     bigint NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type         text NOT NULL,      -- repair | upgrade | replacement | inspection | cleaning | other
  description text NOT NULL,
  performed_by text,
  performed_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS maintenance_logs_asset_idx ON maintenance_logs (asset_id, performed_at DESC);

-- ===== Cấp tên máy tự động: {CHI_NHÁNH}{YY}-{LINE}-{STT}, vd VN26-F1-001 =====
CREATE TABLE IF NOT EXISTS hostname_counters (
  branch   text    NOT NULL,
  year     integer NOT NULL,
  line     text    NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (branch, year, line)
);

-- Số thứ tự được tăng nguyên tử (INSERT ... ON CONFLICT), nên hai người tạo máy cùng lúc không bao giờ trùng tên.
CREATE OR REPLACE FUNCTION next_hostname(p_branch text, p_year integer, p_line text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq integer;
BEGIN
  INSERT INTO hostname_counters (branch, year, line, last_seq)
  VALUES (p_branch, p_year, p_line, 1)
  ON CONFLICT (branch, year, line) DO UPDATE SET last_seq = hostname_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN p_branch || lpad((p_year % 100)::text, 2, '0') || '-' || p_line || '-' || lpad(v_seq::text, 3, '0');
END;
$$;

-- ===== Cây mẫu tối thiểu để màn hình cây thông 3D có tầng hiển thị (chỉ chèn khi bảng còn trống) =====
-- Đổi tên / mã cho đúng thực tế, hoặc thêm node bằng API POST /api/tree.
INSERT INTO tree_nodes (parent_id, name, code, node_type, description)
SELECT NULL, 'Công ty', 'VN', 'company', 'Gốc của cây'
WHERE NOT EXISTS (SELECT 1 FROM tree_nodes);

INSERT INTO tree_nodes (parent_id, name, code, node_type, description)
SELECT (SELECT id FROM tree_nodes WHERE parent_id IS NULL ORDER BY id LIMIT 1), v.name, v.code, 'workshop', v.descr
FROM (VALUES
  ('Tầng 1', 'F1', 'Tầng 1'),
  ('Tầng 2', 'F2', 'Tầng 2'),
  ('Tầng 3', 'F3', 'Tầng 3'),
  ('Tầng 4', 'F4', 'Tầng 4')
) AS v(name, code, descr)
WHERE (SELECT COUNT(*) FROM tree_nodes) = 1;

COMMIT;
