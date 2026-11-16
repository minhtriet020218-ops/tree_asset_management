-- Dữ liệu mẫu: 50 thiết bị (42 PC/Laptop + 8 Printer) + 40 Monitor gắn vào 20 PC đầu tiên.
-- Yêu cầu: đã chạy 001_ad_sync.sql và 002_real_data.sql, và bảng tree_nodes đã có node.
-- Tất cả hostname bắt đầu bằng DEMO- để dễ xóa. An toàn khi chạy lại (hostname trùng sẽ bị bỏ qua).

-- ===== 1) 50 thiết bị, rải đều lên các tầng (node không phải gốc) =====
WITH nodes AS (
  SELECT COALESCE(
    (SELECT array_agg(id ORDER BY id) FROM tree_nodes WHERE parent_id IS NOT NULL),
    (SELECT array_agg(id ORDER BY id) FROM tree_nodes)
  ) AS ids
),
s AS (
  SELECT n,
         md5('demo-' || n) AS h,
         CASE WHEN n % 6 = 0 THEN 'Printer' WHEN n % 3 = 1 THEN 'PC' ELSE 'Laptop' END AS category,
         CASE WHEN n % 10 = 0 THEN 'offline' WHEN n % 20 = 7 THEN 'maintenance' ELSE 'online' END AS status
  FROM generate_series(1, 50) AS n
)
INSERT INTO assets (
  node_id, it_asset_code, hostname, category, product, production_line,
  finance_asset_code, po_invoice, serial_number, mac_address, status,
  assigned_to, staff_code, mail_user, department, fail_count, last_seen_at
)
SELECT
  nodes.ids[1 + (s.n % array_length(nodes.ids, 1))],
  'VN-' || nextval('asset_code_seq'),
  'DEMO-' || CASE WHEN s.category = 'Printer' THEN 'PRN' ELSE 'PC' END || lpad(s.n::text, 3, '0'),
  s.category,
  CASE s.category WHEN 'PC' THEN 'Dell OptiPlex 7090'
                  WHEN 'Laptop' THEN 'Dell Latitude 5420'
                  ELSE 'Zebra ZT411' END,
  (ARRAY['Line SMT 01', 'Line Lắp Ráp 02', 'Line Đóng Gói 03'])[1 + s.n % 3],
  'FA-' || lpad(s.n::text, 5, '0'),
  'PO-2026-' || lpad((1 + s.n % 12)::text, 3, '0'),
  upper(substr(s.h, 11, 10)),
  upper('02:' || substr(s.h, 1, 2) || ':' || substr(s.h, 3, 2) || ':' || substr(s.h, 5, 2) || ':' ||
        substr(s.h, 7, 2) || ':' || substr(s.h, 9, 2)),
  s.status,
  CASE WHEN s.category = 'Printer' THEN NULL ELSE
    (ARRAY['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Thị Dung', 'Võ Minh Đức',
           'Đặng Thị Em', 'Bùi Quốc Phong', 'Hoàng Thị Giang', 'Phan Văn Hải', 'Vũ Thị Lan'])[1 + s.n % 10]
  END,
  CASE WHEN s.category = 'Printer' THEN NULL ELSE 'VN26' || lpad((1000 + s.n)::text, 4, '0') END,
  CASE WHEN s.category = 'Printer' THEN NULL ELSE 'user' || lpad(s.n::text, 3, '0') || '@example.com' END,
  (ARRAY['PMC', 'IT', 'Production', 'QA'])[1 + s.n % 4],
  CASE WHEN s.status = 'offline' THEN 2 ELSE 0 END,
  CASE WHEN s.status = 'offline' THEN now() - interval '2 days' ELSE now() END
FROM s CROSS JOIN nodes
ON CONFLICT ((lower(hostname))) DO NOTHING;

-- ===== 2) Monitor: 2 màn hình cho mỗi PC trong 20 PC đầu (chạy MỘT lần) =====
INSERT INTO assets (
  node_id, it_asset_code, category, product, production_line, po_invoice,
  serial_number, status, parent_asset_id, last_seen_at
)
SELECT p.node_id, 'VN-' || nextval('asset_code_seq'), 'Monitor', 'Dell P2422H', p.production_line, p.po_invoice,
       upper(substr(md5(p.id::text || '-' || m::text), 1, 10)), p.status, p.id, p.last_seen_at
FROM assets p CROSS JOIN generate_series(1, 2) AS m
WHERE p.hostname LIKE 'DEMO-PC%'
  AND NOT EXISTS (SELECT 1 FROM assets c WHERE c.parent_asset_id = p.id)
ORDER BY p.id, m
LIMIT 40;

-- ===== Kiểm tra =====
SELECT status, COUNT(*) FROM assets WHERE hostname LIKE 'DEMO-%' GROUP BY status;
SELECT node_id, COUNT(*) FROM assets WHERE hostname LIKE 'DEMO-%' GROUP BY node_id ORDER BY node_id;

-- ===== Xóa toàn bộ dữ liệu mẫu (khi không cần nữa) =====
-- DELETE FROM assets WHERE parent_asset_id IN (SELECT id FROM assets WHERE hostname LIKE 'DEMO-%');
-- DELETE FROM assets WHERE hostname LIKE 'DEMO-%';