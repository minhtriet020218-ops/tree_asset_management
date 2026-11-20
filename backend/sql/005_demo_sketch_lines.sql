-- Dữ liệu mẫu theo bản vẽ tay: 8 line, 59 tài sản (32 màn hình gồm cả monitor show up, 22 PC, 5 máy in).
--
--   Line 1: 2 PC, 3 màn hình + 1 show up (nối với PC thứ 2), 1 máy in phía trước       = 7
--   Line 2: 2 PC, 4 màn hình                                                          = 6
--   Line 3: 3 PC (2 PC to + 1 PC nhỏ), 3 màn hình                                     = 6
--   Line 4: 3 PC, 3 màn hình                                                          = 6
--   Line 5: 3 PC, 3 màn hình, 1 máy in cuối line                                      = 7
--   Line 6: 3 PC, 3 màn hình, 1 máy in cuối line                                      = 7
--   Line 7: 3 PC, 5 màn hình + 1 show up (nối với PC đầu), 1 máy in đầu line          = 10
--   Line 8: 3 PC, 5 màn hình + 1 show up (nối với PC đầu), 1 máy in cuối line         = 10
--
-- CÁCH DÙNG: dán toàn bộ vào pgAdmin rồi chạy. Mặc định đặt tất cả vào tầng đầu tiên (không phải gốc) của cây.
-- Muốn chọn tầng khác: đổi dòng  v_node_name text := NULL;  thành  v_node_name text := 'Tên tầng';
--
-- LƯU Ý: script này XÓA dữ liệu mẫu cũ (mọi máy có hostname bắt đầu bằng DEMO- và màn hình gắn vào chúng)
-- trước khi tạo lại, nên chạy lại bao nhiêu lần cũng được. Không đụng tới máy thật.
-- Tên line "Line 1".."Line 8" phải trùng với khóa trong LINE_LAYOUT (schematic3dLayout.ts).
--
-- Ngoài 59 tài sản đã vào line, script còn tạo thêm 7 thiết bị DỰ PHÒNG trong KHO (chưa có node, chưa có Line):
-- 2 PC, 3 màn hình, 1 monitor show up, 1 máy in Zebra. Dùng để thử kéo thả từ Kho ra sơ đồ 3D.
-- (Cần chạy 006_stock_assignment.sql để cột in_stock có hiệu lực.)
DO $$
DECLARE
  v_node_name text := NULL;
  v_node      bigint;
  v_spec      jsonb := '[
    {"line":"Line 1","printers":1,"pcs":[{"t":"pc","m":["m","m"]},{"t":"pc","m":["m","show"]}]},
    {"line":"Line 2","printers":0,"pcs":[{"t":"pc","m":["m","m"]},{"t":"pc","m":["m","m"]}]},
    {"line":"Line 3","printers":0,"pcs":[{"t":"tower","m":["m"]},{"t":"tower","m":["m"]},{"t":"pc","m":["m"]}]},
    {"line":"Line 4","printers":0,"pcs":[{"t":"pc","m":["m"]},{"t":"pc","m":["m"]},{"t":"pc","m":["m"]}]},
    {"line":"Line 5","printers":1,"pcs":[{"t":"pc","m":["m"]},{"t":"pc","m":["m"]},{"t":"pc","m":["m"]}]},
    {"line":"Line 6","printers":1,"pcs":[{"t":"pc","m":["m"]},{"t":"pc","m":["m"]},{"t":"pc","m":["m"]}]},
    {"line":"Line 7","printers":1,"pcs":[{"t":"pc","m":["show","m"]},{"t":"pc","m":["m","m"]},{"t":"pc","m":["m","m"]}]},
    {"line":"Line 8","printers":1,"pcs":[{"t":"pc","m":["show","m"]},{"t":"pc","m":["m","m"]},{"t":"pc","m":["m","m"]}]}
  ]'::jsonb;
  v_users text[] := ARRAY['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Thị Dung', 'Võ Minh Đức',
                          'Đặng Thị Em', 'Bùi Quốc Phong', 'Hoàng Thị Giang', 'Phan Văn Hải', 'Vũ Thị Lan'];
  v_depts text[] := ARRAY['PMC', 'IT', 'Production', 'QA'];
  v_line  jsonb;
  v_pc    jsonb;
  v_kind  text;
  v_li    int := 0;
  v_pi    int;
  v_mi    int;
  v_k     int;
  v_n     int := 0;   -- đếm toàn bộ tài sản, để sinh mã/serial không trùng
  v_pc_id bigint;
  v_h     text;
BEGIN
  -- 1) Chọn tầng
  IF v_node_name IS NULL THEN
    SELECT id INTO v_node FROM tree_nodes WHERE parent_id IS NOT NULL ORDER BY id LIMIT 1;
    IF v_node IS NULL THEN
      SELECT id INTO v_node FROM tree_nodes ORDER BY id LIMIT 1;
    END IF;
  ELSE
    SELECT id INTO v_node FROM tree_nodes WHERE name = v_node_name ORDER BY id LIMIT 1;
  END IF;
  IF v_node IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy tầng. Các node hiện có: %', (SELECT string_agg(name, ', ') FROM tree_nodes);
  END IF;
  RAISE NOTICE 'Tạo tài sản vào node: % (id %)', (SELECT name FROM tree_nodes WHERE id = v_node), v_node;

  -- 2) Xóa dữ liệu mẫu cũ (chỉ máy DEMO-* và màn hình gắn vào chúng)
  IF to_regclass('maintenance_logs') IS NOT NULL THEN
    DELETE FROM maintenance_logs
    WHERE asset_id IN (SELECT id FROM assets WHERE hostname LIKE 'DEMO-%'
                          OR parent_asset_id IN (SELECT id FROM assets WHERE hostname LIKE 'DEMO-%'));
  END IF;
  DELETE FROM assets WHERE parent_asset_id IN (SELECT id FROM assets WHERE hostname LIKE 'DEMO-%');
  DELETE FROM assets WHERE hostname LIKE 'DEMO-%';
  DELETE FROM assets WHERE it_asset_code LIKE 'DEMO-STK-%';   -- thiết bị mẫu trong Kho (màn hình không có hostname)

  -- 3) Tạo tài sản theo bản vẽ
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_spec) LOOP
    v_li := v_li + 1;
    v_pi := 0;

    FOR v_pc IN SELECT * FROM jsonb_array_elements(v_line->'pcs') LOOP
      v_pi := v_pi + 1;
      v_n  := v_n + 1;
      v_h  := md5('sketch-' || v_n);
      INSERT INTO assets (
        node_id, it_asset_code, hostname, category, product, production_line,
        finance_asset_code, po_invoice, serial_number, mac_address, status,
        assigned_to, staff_code, mail_user, department, fail_count, last_seen_at
      ) VALUES (
        v_node, 'VN-' || nextval('asset_code_seq'),
        format('DEMO-L%s-PC%s', v_li, v_pi),
        'PC',
        CASE WHEN v_pc->>'t' = 'tower' THEN 'HP Z4 Workstation' ELSE 'HP ProDesk 400 G3 SFF' END,
        v_line->>'line',
        'FA-' || lpad(v_n::text, 5, '0'), 'PO-2026-001',
        upper(substr(v_h, 11, 10)),
        upper('02:' || substr(v_h, 1, 2) || ':' || substr(v_h, 3, 2) || ':' || substr(v_h, 5, 2) || ':' ||
              substr(v_h, 7, 2) || ':' || substr(v_h, 9, 2)),
        'online',
        v_users[1 + v_n % 10], 'VN26' || lpad((1000 + v_n)::text, 4, '0'),
        'user' || lpad(v_n::text, 3, '0') || '@example.com', v_depts[1 + v_n % 4],
        0, now()
      ) RETURNING id INTO v_pc_id;

      -- màn hình của PC này ('m' = màn hình thường, 'show' = monitor show up)
      v_mi := 0;
      FOR v_kind IN SELECT jsonb_array_elements_text(v_pc->'m') LOOP
        v_mi := v_mi + 1;
        v_n  := v_n + 1;
        INSERT INTO assets (
          node_id, it_asset_code, category, product, production_line, po_invoice,
          serial_number, status, parent_asset_id, last_seen_at
        ) VALUES (
          v_node, 'VN-' || nextval('asset_code_seq'),
          CASE WHEN v_kind = 'show' THEN 'Monitor show up' ELSE 'Monitor' END,
          CASE WHEN v_kind = 'show' THEN 'LED Andon 32 inch' ELSE 'Dell P2422H' END,
          v_line->>'line', 'PO-2026-001',
          upper(substr(md5('sketch-' || v_n), 1, 10)), 'online', v_pc_id, now()
        );
      END LOOP;
    END LOOP;

    -- máy in Zebra của line
    FOR v_k IN 1..COALESCE((v_line->>'printers')::int, 0) LOOP
      v_n := v_n + 1;
      INSERT INTO assets (
        node_id, it_asset_code, hostname, category, product, production_line,
        finance_asset_code, po_invoice, serial_number, status, department, fail_count, last_seen_at
      ) VALUES (
        v_node, 'VN-' || nextval('asset_code_seq'),
        format('DEMO-L%s-PRN%s', v_li, v_k),
        'Printer', 'Zebra ZT411', v_line->>'line',
        'FA-' || lpad(v_n::text, 5, '0'), 'PO-2026-001',
        upper(substr(md5('sketch-' || v_n), 1, 10)), 'online', 'Production', 0, now()
      );
    END LOOP;
  END LOOP;

  -- 3b) Thiết bị dự phòng trong KHO: để trống node và Line => in_stock = true
  INSERT INTO assets (it_asset_code, hostname, category, product, po_invoice, serial_number, status, fail_count, last_seen_at)
  SELECT s.code, s.host, s.cat, s.prod, 'PO-2026-002', upper(substr(md5('stock-' || s.code), 1, 10)), 'online', 0, now()
  FROM (VALUES
    ('DEMO-STK-PC1',   'DEMO-STK-PC1', 'PC',              'HP ProDesk 400 G3 SFF'),
    ('DEMO-STK-PC2',   'DEMO-STK-PC2', 'PC',              'HP Z4 Workstation'),
    ('DEMO-STK-MON1',  NULL,           'Monitor',         'Dell P2422H'),
    ('DEMO-STK-MON2',  NULL,           'Monitor',         'Dell P2422H'),
    ('DEMO-STK-MON3',  NULL,           'Monitor',         'Dell P2422H'),
    ('DEMO-STK-SHOW1', NULL,           'Monitor show up', 'LED Andon 32 inch'),
    ('DEMO-STK-PRN1',  'DEMO-STK-PRN1','Printer',         'Zebra ZT411')
  ) AS s(code, host, cat, prod);

  -- 4) Đánh dấu máy mẫu để kiểm tra mạng / cảnh báo bỏ qua (chỉ khi is_demo là cột thường)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'assets' AND column_name = 'is_demo' AND is_generated = 'NEVER') THEN
    UPDATE assets SET is_demo = true WHERE hostname LIKE 'DEMO-%';
  END IF;
END $$;

-- Kiểm tra: phải ra 8 line, tổng 59 tài sản
SELECT production_line AS line,
       COUNT(*) FILTER (WHERE category = 'PC')              AS pc,
       COUNT(*) FILTER (WHERE category LIKE 'Monitor%')     AS man_hinh,
       COUNT(*) FILTER (WHERE category = 'Printer')         AS may_in,
       COUNT(*)                                             AS tong
FROM assets
WHERE production_line LIKE 'Line %' AND (hostname LIKE 'DEMO-%' OR parent_asset_id IN (SELECT id FROM assets WHERE hostname LIKE 'DEMO-%'))
GROUP BY production_line
ORDER BY production_line;
