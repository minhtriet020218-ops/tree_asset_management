const db = require('../config/db');

class TreeRepository {
  // Thống kê theo từng node, gồm cả tài sản của các node con (đệ quy).
  // Monitor không tính vào số máy (trạng thái của nó đi theo PC).
  async getStats() {
    const result = await db.query(`
      WITH RECURSIVE sub AS (
        SELECT id AS root_id, id AS node_id FROM tree_nodes
        UNION ALL
        SELECT s.root_id, t.id FROM sub s JOIN tree_nodes t ON t.parent_id = s.node_id
      )
      SELECT n.id, n.parent_id, n.name, n.code, n.node_type, n.description,
             COUNT(a.id)::int                                          AS total,
             COUNT(a.id) FILTER (WHERE a.status = 'online')::int       AS online,
             COUNT(a.id) FILTER (WHERE a.status = 'offline')::int      AS offline
      FROM tree_nodes n
      LEFT JOIN sub s ON s.root_id = n.id
      LEFT JOIN assets a
             ON a.node_id = s.node_id
            AND a.liquidated_at IS NULL
            AND COALESCE(a.category, '') NOT ILIKE '%monitor%'
      GROUP BY n.id
      ORDER BY n.id;
    `);
    return result.rows;
  }
}

module.exports = new TreeRepository();
