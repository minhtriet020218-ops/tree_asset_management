-- XÓA TOÀN BỘ TÀI SẢN để làm lại từ đầu (dữ liệu thật sẽ lấy về từ AD / nhập tay sau).
--
-- Xóa: mọi dòng trong assets + maintenance_logs của chúng.
-- Giữ nguyên: cây tầng / khu vực (tree_nodes), cấu hình, lịch sử thanh lý nằm ngoài bảng assets (nếu có).
-- KHÔNG HOÀN TÁC ĐƯỢC sau khi COMMIT: BACKUP DB TRƯỚC.
--
-- Xem trước (chạy riêng, không xóa gì):
-- SELECT COUNT(*) AS tong_dong, COUNT(*) FILTER (WHERE liquidated_at IS NULL) AS dang_dung,
--        COUNT(*) FILTER (WHERE liquidated_at IS NOT NULL) AS da_thanh_ly FROM assets;

BEGIN;

DO $$
DECLARE v_logs bigint := 0; v_assets bigint := 0;
BEGIN
  IF to_regclass('maintenance_logs') IS NOT NULL THEN
    DELETE FROM maintenance_logs;
    GET DIAGNOSTICS v_logs = ROW_COUNT;
  END IF;
  DELETE FROM assets;
  GET DIAGNOSTICS v_assets = ROW_COUNT;
  RAISE NOTICE 'Đã xóa % tài sản và % dòng lịch sử bảo trì.', v_assets, v_logs;
END $$;

-- Tùy chọn: đánh số hostname lại từ 001 cho chi nhánh/năm/line (bỏ dấu -- ở dòng dưới nếu muốn)
-- DELETE FROM hostname_counters;

COMMIT;

SELECT COUNT(*) AS tai_san_con_lai FROM assets; -- phải = 0
