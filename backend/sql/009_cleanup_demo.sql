-- Dọn dữ liệu mẫu (demo) trước khi chạy dữ liệu thật từ AD.
--
-- Chỉ xóa:
--   * máy có hostname bắt đầu bằng DEMO-   (PC, máy in, thiết bị Kho mẫu DEMO-STK-...)
--   * thiết bị có it_asset_code bắt đầu bằng DEMO-STK-  (màn hình mẫu trong Kho, không có hostname)
--   * màn hình đang gắn vào một máy DEMO-*  (parent_asset_id trỏ tới máy DEMO-*)
--   * lịch sử bảo trì (maintenance_logs) của các thiết bị trên
-- KHÔNG đụng tới máy thật, cây tầng/khu vực (tree_nodes), hay máy nào không thuộc nhóm trên.
--
-- LÀM THEO THỨ TỰ:
--   1) Backup DB.
--   2) Chạy RIÊNG câu xem trước ở dưới (bôi đen rồi F5), kiểm tra danh sách đúng là máy demo.
--   3) Chạy cả file này.

-- ===== Câu xem trước (chạy riêng, KHÔNG xóa gì) =====
-- SELECT id, hostname, it_asset_code, category, production_line
-- FROM assets
-- WHERE hostname LIKE 'DEMO-%'
--    OR it_asset_code LIKE 'DEMO-STK-%'
--    OR parent_asset_id IN (SELECT id FROM assets WHERE hostname LIKE 'DEMO-%')
-- ORDER BY id;

BEGIN;

DO $$
DECLARE
  v_ids bigint[];
  v_logs bigint := 0;
  v_assets bigint := 0;
BEGIN
  SELECT coalesce(array_agg(DISTINCT id), '{}') INTO v_ids
  FROM assets
  WHERE hostname LIKE 'DEMO-%'
     OR it_asset_code LIKE 'DEMO-STK-%'
     OR parent_asset_id IN (SELECT id FROM assets WHERE hostname LIKE 'DEMO-%');

  RAISE NOTICE 'Tìm thấy % thiết bị demo.', coalesce(array_length(v_ids, 1), 0);

  IF to_regclass('maintenance_logs') IS NOT NULL AND coalesce(array_length(v_ids, 1), 0) > 0 THEN
    DELETE FROM maintenance_logs WHERE asset_id = ANY (v_ids);
    GET DIAGNOSTICS v_logs = ROW_COUNT;
  END IF;

  IF coalesce(array_length(v_ids, 1), 0) > 0 THEN
    DELETE FROM assets WHERE id = ANY (v_ids);
    GET DIAGNOSTICS v_assets = ROW_COUNT;
  END IF;

  RAISE NOTICE 'Đã xóa % thiết bị và % dòng lịch sử bảo trì.', v_assets, v_logs;
END $$;

COMMIT;

-- Kiểm tra sau khi dọn: dòng 1 phải = 0
SELECT 'còn lại máy demo' AS muc, COUNT(*) AS so_luong
FROM assets WHERE hostname LIKE 'DEMO-%' OR it_asset_code LIKE 'DEMO-STK-%'
UNION ALL
SELECT 'tổng tài sản còn lại (chưa thanh lý)', COUNT(*) FROM assets WHERE liquidated_at IS NULL
UNION ALL
SELECT 'trong đó đánh dấu is_demo', COUNT(*) FROM assets WHERE is_demo AND liquidated_at IS NULL;
