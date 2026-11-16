-- Chạy một lần trên database tree_asset_management
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS os             text,
  ADD COLUMN IF NOT EXISTS ad_description text,
  ADD COLUMN IF NOT EXISTS ad_last_logon  timestamptz,
  ADD COLUMN IF NOT EXISTS ad_enabled     boolean,
  ADD COLUMN IF NOT EXISTS ad_synced_at   timestamptz,
  ADD COLUMN IF NOT EXISTS fail_count     integer NOT NULL DEFAULT 0;

-- Cho phép máy mới từ AD chưa có node (nếu không đặt AD_DEFAULT_NODE_ID)
ALTER TABLE assets ALTER COLUMN node_id DROP NOT NULL;

-- Hostname là khóa đồng bộ, không phân biệt hoa/thường.
-- Nếu lệnh này báo lỗi duplicate, hãy xử lý hostname trùng trước:
--   SELECT lower(hostname), count(*) FROM assets GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS assets_hostname_lower_uq ON assets (lower(hostname));