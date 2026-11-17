const db = require('../config/db');

const TYPES = ['repair', 'upgrade', 'replacement', 'inspection', 'cleaning', 'other'];

class MaintenanceRepository {
  async listByAsset(assetId) {
    const result = await db.query(
      `SELECT * FROM maintenance_logs WHERE asset_id = $1::bigint ORDER BY performed_at DESC, id DESC`,
      [assetId]
    );
    return result.rows;
  }

  /**
   * Thêm 1 dòng lịch sử. Nếu có muteHours thì đồng thời tắt cảnh báo offline của thiết bị trong N giờ
   * (CTE ghi dữ liệu chạy nguyên tử: hoặc cả hai thành công, hoặc không gì cả).
   * Mute không đổi trạng thái online/offline thật và tự hủy khi probe thấy máy online lại.
   * Trả về undefined nếu thiết bị không tồn tại (hoặc đã thanh lý).
   */
  async create(assetId, d) {
    const result = await db.query(
      `WITH ins AS (
         INSERT INTO maintenance_logs (asset_id, type, description, performed_by, performed_at)
         SELECT $1::bigint, $2::text, $3::text, $4::text, COALESCE($5::timestamptz, NOW())
         WHERE EXISTS (SELECT 1 FROM assets WHERE id = $1::bigint AND liquidated_at IS NULL)
         RETURNING *
       ),
       upd AS (
         UPDATE assets SET alerts_muted_until = NOW() + make_interval(hours => $6::int)
         WHERE id = $1::bigint AND $6::int IS NOT NULL AND EXISTS (SELECT 1 FROM ins)
         RETURNING id
       )
       SELECT * FROM ins;`,
      [assetId, d.type, d.description, d.performed_by || null, d.performed_at || null, d.mute_hours || null]
    );
    return result.rows[0];
  }

  async delete(assetId, logId) {
    const result = await db.query(
      `DELETE FROM maintenance_logs WHERE id = $1::bigint AND asset_id = $2::bigint RETURNING id`,
      [logId, assetId]
    );
    return result.rows[0];
  }
}

const repo = new MaintenanceRepository();
repo.TYPES = TYPES;
module.exports = repo;
