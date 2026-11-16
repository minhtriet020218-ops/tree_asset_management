const db = require('../config/db');

const CHUNK = 1000;

// '' hoặc chỉ có khoảng trắng -> null (tránh trùng unique index khi nhiều dòng để trống)
const n = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const toId = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

class AssetRepository {
  // includeChildren = true: lấy cả tài sản của các node con (khớp với số liệu thống kê trên cây)
  async findAll(nodeId, status, search, includeChildren = true) {
    let query = 'SELECT * FROM assets WHERE 1=1';
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

  async create(d) {
    const result = await db.query(
      `INSERT INTO assets (
         node_id, it_asset_code, hostname, category, product, production_line,
         finance_asset_code, po_invoice, serial_number, mac_address, status,
         assigned_to, staff_code, mail_user, department, parent_asset_id, last_seen_at
       ) VALUES (
         $1, COALESCE($2::text, 'VN-' || nextval('asset_code_seq')), $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, CURRENT_TIMESTAMP
       ) RETURNING *;`,
      [
        toId(d.node_id), n(d.it_asset_code), n(d.hostname), n(d.category), n(d.product), n(d.production_line),
        n(d.finance_asset_code), n(d.po_invoice), n(d.serial_number), n(d.mac_address), d.status || 'online',
        n(d.assigned_to), n(d.staff_code), n(d.mail_user), n(d.department), toId(d.parent_asset_id),
      ]
    );
    return result.rows[0];
  }

  async update(id, d) {
    const parent = toId(d.parent_asset_id);
    const result = await db.query(
      `UPDATE assets SET
         node_id            = COALESCE($1, node_id),
         it_asset_code      = COALESCE($2::text, it_asset_code),
         hostname           = $3,
         category           = $4,
         product            = $5,
         production_line    = $6,
         finance_asset_code = $7,
         po_invoice         = $8,
         serial_number      = $9,
         mac_address        = $10,
         status             = COALESCE($11, status),
         assigned_to        = $12,
         staff_code         = $13,
         mail_user          = $14,
         department         = $15,
         parent_asset_id    = $16
       WHERE id = $17
       RETURNING *;`,
      [
        toId(d.node_id), n(d.it_asset_code), n(d.hostname), n(d.category), n(d.product), n(d.production_line),
        n(d.finance_asset_code), n(d.po_invoice), n(d.serial_number), n(d.mac_address), n(d.status),
        n(d.assigned_to), n(d.staff_code), n(d.mail_user), n(d.department),
        parent === Number(id) ? null : parent, // không cho tự gắn vào chính nó
        id,
      ]
    );
    return result.rows[0];
  }

  async delete(id) {
    const result = await db.query('DELETE FROM assets WHERE id = $1 RETURNING *;', [id]);
    return result.rows[0];
  }

  // Đếm theo trạng thái ở phía SQL (không tính Monitor)
  async countByStatus() {
    const result = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM assets
       WHERE COALESCE(category, '') NOT ILIKE '%monitor%'
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
         AND hostname NOT ILIKE 'DEMO-%'`  // bỏ qua máy dữ liệu mẫu
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
                           WHEN a.status = 'maintenance' THEN a.status
                           WHEN t.ok THEN 'online'
                           WHEN a.fail_count + 1 >= $3 THEN 'offline'
                           ELSE a.status
                         END
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