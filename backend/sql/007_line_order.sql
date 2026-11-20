-- Di chuyển tự do: thứ tự thiết bị trong line.
--
-- line_order nhỏ = đứng trước (bên trái) trong khung line trên sơ đồ 3D. IT kéo thả thiết bị tới đâu thì
-- hệ thống lưu số nằm giữa 2 thiết bị cùng loại ở hai bên vị trí đó (vd 2 và 3 -> 2.5), nên chỉ cần ghi 1 dòng.
-- NULL = chưa ai sắp xếp: xếp theo tên như trước.
BEGIN;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS line_order double precision;

COMMIT;

-- Kiểm tra:
-- SELECT production_line, hostname, line_order FROM assets WHERE line_order IS NOT NULL ORDER BY 1, 3;
