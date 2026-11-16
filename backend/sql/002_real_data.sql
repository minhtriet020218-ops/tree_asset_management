-- Chạy sau 001_ad_sync.sql
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS assigned_to     text,
  ADD COLUMN IF NOT EXISTS staff_code      text,
  ADD COLUMN IF NOT EXISTS mail_user       text,
  ADD COLUMN IF NOT EXISTS department      text,
  ADD COLUMN IF NOT EXISTS parent_asset_id bigint REFERENCES assets(id) ON DELETE SET NULL;

-- Monitor không có hostname
ALTER TABLE assets ALTER COLUMN hostname DROP NOT NULL;

CREATE INDEX IF NOT EXISTS assets_parent_idx ON assets (parent_asset_id);
CREATE INDEX IF NOT EXISTS assets_node_idx   ON assets (node_id);

-- Mã tài sản tự sinh (VN-10001, VN-10002...) khi để trống ở form
CREATE SEQUENCE IF NOT EXISTS asset_code_seq START 10001;