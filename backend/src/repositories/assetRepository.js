const db = require('../config/db');

const CHUNK = 1000;

// '' hoặc chỉ có khoảng trắng -> null (tránh trùng unique index khi nhiều dòng để trống)
const n = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const toId = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

class AssetRepository {
  // includeChildren = true: lấy cả tài sản của các node con (khớp với số liệu thống kê trên cây)
  async findAll(nodeId, status, search, includeChildren = true) {
    let query = 'SELECT * FROM assets WHERE liquidated_at IS NULL';
    const params = [];
    let idx = 1;

    if (nodeId) {
      if (includeChildren) {
        query += ` AND node_id IN (
          WITH RECURSIVE sub AS (
            SELECT id FROM tree_nodes WHERE id = $${idx}
            UNION ALL
            SELECT t.id FROM tree_nodes t JOIN sub s ON t.parent_id = s.id
          ) SELECT id FROM sub)`;
      } else {
        query += ` AND node_id = $${idx}`;
      }
      params.push(nodeId);
      idx++;
    }
    if (status) {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (search) {
      query += ` AND (it_asset_code ILIKE $${idx} OR hostname ILIKE $${idx} OR serial_number ILIKE $${idx} OR assigned_to ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY id DESC';
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Tạo mới. status KHÔNG nhận từ form: chỉ probe mới quyết định online/offline.
   * - Monitor kế thừa trạng thái của PC nó gắn vào; thiết bị khác bắt đầu 'offline' tới lượt probe đầu tiên.
   * - Máy có hostname được tắt cảnh báo offline `graceDays` ngày để IT kịp đổi tên máy thật + join AD
   *   (mute tự xóa ngay khi probe thấy máy online).
   */
  async create(d, { graceDays = 0 } = {}) {
    const result = await db.query(
      `INSERT INTO assets (
         node_id, it_asset_code, hostname, category, product, production_line,
         finance_asset_code, po_invoice, serial_number, mac_address, status,
         assigned_to, staff_code, mail_user, department, parent_asset_id, last_seen_at,
         alerts_muted_until
       ) VALUES (
         $1, COALESCE($2::text, 'VN-' || nextval('asset_code_seq')), $3::text, $4, $5, $6,
         $7, $8, $9, $10, COALESCE((SELECT status FROM assets WHERE id = $16::bigint), 'offline'),
         $11, $12, $13, $14, $16::bigint, (SELECT last_seen_at FROM assets WHERE id = $16::bigint),
         CASE WHEN $3::text IS NOT NULL AND $15::int > 0 THEN NOW() + make_interval(days => $15::int) END
       ) RETURNING *;`,
      [
        toId(d.node_id), n(d.it_asset_code), n(d.hostname), n(d.category), n(d.product), n(d.production_line), // $1-$6
        n(d.finance_asset_code), n(d.po_invoice), n(d.serial_number), n(d.mac_address),                         // $7-$10
        n(d.assigned_to), n(d.staff_code), n(d.mail_user), n(d.department),                                    // $11-$14
        graceDays,                                                                                             // $15
        toId(d.parent_asset_id),                                                                               // $16
      ]
    );
    return result.rows[0];
  }

  // Không sửa status ở đây (do probe quyết định). Không cho xóa trắng hostname vì probe cần nó.
  async update(id, d) {
    const parent = toId(d.parent_asset_id);
    const result = await db.query(
      `UPDATE assets SET
         node_id            = COALESCE($1, node_id),
         it_asset_code      = COALESCE($2::text, it_asset_code),
         hostname           = COALESCE($3::text, hostname),
         category           = $4,
         product            = $5,
         production_line    = $6,
         finance_asset_code = $7,
         po_invoice         = $8,
         serial_number      = $9,
         mac_address        = $10,
         assigned_to        = $11,
         staff_code         = $12,
         mail_user          = $13,
         department         = $14,
         parent_asset_id    = $15
       WHERE id = $16 AND liquidated_at IS NULL
       RETURNING *;`,
      [
        toId(d.node_id), n(d.it_asset_code), n(d.hostname), n(d.category), n(d.product), n(d.production_line),
        n(d.finance_asset_code), n(d.po_invoice), n(d.serial_number), n(d.mac_address),
        n(d.assigned_to), n(d.staff_code), n(d.mail_user), n(d.department),
        parent === Number(id) ? null : parent, // không cho tự gắn vào chính nó
        id,
      ]
    );
    return result.rows[0];
  }

  // "Thanh lý" = soft delete: giữ bản ghi (và hostname) để AD sync không tạo lại máy này, đồng thời loại nó
  // khỏi giám sát / cảnh báo / thống kê. Monitor đang gắn vào máy này được tách ra (thành monitor chưa gắn PC).
  async delete(id) {
    const result = await db.query(
      `WITH d AS (
         UPDATE assets
         SET liquidated_at = NOW(), alerts_muted_until = NULL, offline_since = NULL, offline_alerted_at = NULL
         WHERE id = $1::bigint AND liquidated_at IS NULL
         RETURNING id
       ),
       c AS (
         UPDATE assets SET parent_asset_id = NULL WHERE parent_asset_id IN (SELECT id FROM d)
       )
       SELECT id FROM d;`,
      [id]
    );
    return result.rows[0];
  }

  // Đếm theo trạng thái ở phía SQL (không tính Monitor)
  async countByStatus() {
    const result = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM assets
       WHERE COALESCE(category, '') NOT ILIKE '%monitor%'
         AND liquidated_at IS NULL
       GROUP BY status;`
    );
    return result.rows;
  }

  // Dữ liệu cho các ô chọn trong form (line, phòng ban, loại thiết bị)
  async getMeta() {
    const [lines, departments, categories] = await Promise.all([
      db.query(`SELECT production_line AS v FROM assets WHERE production_line IS NOT NULL AND production_line <> ''
                UNION SELECT name FROM tree_nodes WHERE node_type = 'line' ORDER BY 1`),
      db.query(`SELECT DISTINCT department AS v FROM assets WHERE department IS NOT NULL AND department <> '' ORDER BY 1`),
      db.query(`SELECT DISTINCT category AS v FROM assets WHERE category IS NOT NULL AND category <> '' ORDER BY 1`),
    ]);
    const merge = (rows, defaults = []) => [...new Set([...defaults, ...rows.map((r) => r.v)])];
    return {
      lines: merge(lines.rows),
      departments: merge(departments.rows),
      categories: merge(categories.rows, ['PC', 'Laptop', 'Monitor', 'Printer']),
    };
  }

  /**
   * Upsert hàng loạt máy tính lấy từ AD, khóa theo lower(hostname).
   * Máy đã có: CHỈ cập nhật các cột lấy từ AD, không đụng tới dữ liệu nhập tay.
   */
  async upsertFromAD(computers, defaultNodeId) {
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < computers.length; i += CHUNK) {
      const part = computers.slice(i, i + CHUNK);
      const result = await db.query(
        `
        INSERT INTO assets (hostname, category, node_id, status, os, ad_description, ad_last_logon, ad_enabled, ad_synced_at)
        SELECT t.hostname, 'PC', $6::int, 'offline', t.os, t.descr, t.last_logon, t.enabled, NOW()
        FROM unnest($1::text[], $2::text[], $3::text[], $4::timestamptz[], $5::boolean[])
             AS t(hostname, os, descr, last_logon, enabled)
        ON CONFLICT ((lower(hostname))) DO UPDATE SET
          os             = EXCLUDED.os,
          ad_description = EXCLUDED.ad_description,
          ad_last_logon  = EXCLUDED.ad_last_logon,
          ad_enabled     = EXCLUDED.ad_enabled,
          ad_synced_at   = NOW(),
          last_seen_at   = GREATEST(assets.last_seen_at, EXCLUDED.ad_last_logon)
        RETURNING (xmax = 0) AS inserted;
        `,
        [
          part.map((c) => c.hostname),
          part.map((c) => c.os),
          part.map((c) => c.description),
          part.map((c) => c.lastLogon),
          part.map((c) => c.enabled),
          defaultNodeId,
        ]
      );
      for (const row of result.rows) row.inserted ? inserted++ : updated++;
    }
    return { inserted, updated };
  }

    async listForStatusCheck() {
    const result = await db.query(
      `SELECT id, hostname FROM assets
       WHERE hostname IS NOT NULL AND hostname <> ''
         AND NOT is_demo            -- bỏ qua máy dữ liệu mẫu
         AND liquidated_at IS NULL` // và máy đã thanh lý
    );
    return result.rows;
  }

  async applyStatusResults(results, offlineAfterFails) {
    let online = 0;
    let offline = 0;

    for (let i = 0; i < results.length; i += CHUNK) {
      const part = results.slice(i, i + CHUNK);
      const res = await db.query(
        `
        UPDATE assets a SET
          fail_count   = CASE WHEN t.ok THEN 0 ELSE a.fail_count + 1 END,
          last_seen_at = CASE WHEN t.ok THEN NOW() ELSE a.last_seen_at END,
          status       = CASE
                           WHEN t.ok THEN 'online'
                           WHEN a.fail_count + 1 >= $3 THEN 'offline'
                           ELSE a.status
                         END,
          -- máy đã online lại thì hết tắt cảnh báo (thời gian ân hạn máy mới / bảo trì kết thúc)
          alerts_muted_until = CASE WHEN t.ok THEN NULL ELSE a.alerts_muted_until END
        FROM unnest($1::bigint[], $2::boolean[]) AS t(id, ok)
        WHERE a.id = t.id
        RETURNING a.status;
        `,
        [part.map((r) => r.id), part.map((r) => r.ok), offlineAfterFails]
      );
      for (const row of res.rows) row.status === 'online' ? online++ : offline++;
    }
    return { online, offline };
  }

  // Monitor đi theo trạng thái của PC mà nó gắn vào (monitor không có hostname để kiểm tra)
  async syncChildStatus() {
    await db.query(`
      UPDATE assets c SET status = p.status, last_seen_at = p.last_seen_at
      FROM assets p
      WHERE c.parent_asset_id = p.id
        AND (c.status IS DISTINCT FROM p.status OR c.last_seen_at IS DISTINCT FROM p.last_seen_at);
    `);
  }
}

module.exports = new AssetRepository();
