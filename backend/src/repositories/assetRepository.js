const db = require('../config/db');

class AssetRepository {
  async findAll(nodeId, status, search) {
    let query = 'SELECT * FROM assets WHERE 1=1';
    let params = [];
    let idx = 1;

    if (nodeId) {
      query += ` AND node_id = $${idx++}`;
      params.push(nodeId);
    }
    if (status) {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (search) {
      query += ` AND (it_asset_code ILIKE $${idx} OR hostname ILIKE $${idx} OR serial_number ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY id DESC';
    const result = await db.query(query, params);
    return result.rows;
  }

  async create(data) {
    const {
      node_id, it_asset_code, hostname, category, product,
      production_line, finance_asset_code, po_invoice, serial_number, mac_address, status
    } = data;

    const query = `
      INSERT INTO assets (node_id, it_asset_code, hostname, category, product, production_line, finance_asset_code, po_invoice, serial_number, mac_address, status, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [node_id, it_asset_code, hostname, category, product, production_line, finance_asset_code, po_invoice, serial_number, mac_address, status || 'online'];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async update(id, data) {
    const {
      it_asset_code, hostname, category, product,
      production_line, finance_asset_code, po_invoice, serial_number, mac_address, status
    } = data;

    const query = `
      UPDATE assets 
      SET it_asset_code = $1, hostname = $2, category = $3, product = $4, 
          production_line = $5, finance_asset_code = $6, po_invoice = $7, 
          serial_number = $8, mac_address = $9, status = $10
      WHERE id = $11
      RETURNING *;
    `;
    const values = [it_asset_code, hostname, category, product, production_line, finance_asset_code, po_invoice, serial_number, mac_address, status, id];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async delete(id) {
    const result = await db.query('DELETE FROM assets WHERE id = $1 RETURNING *;', [id]);
    return result.rows[0];
  }
}

module.exports = new AssetRepository();