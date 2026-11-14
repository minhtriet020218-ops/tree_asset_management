const db = require('../config/db');

exports.getAssets = async (req, res) => {
  const { node_id, status, search } = req.query;
  try {
    let query = 'SELECT * FROM assets WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (node_id) {
      query += ` AND node_id = $${paramIndex++}`;
      params.push(node_id);
    }
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (search) {
      query += ` AND (serial_number ILIKE $${paramIndex} OR hostname ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY id DESC';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createAsset = async (req, res) => {
  const { node_id, serial_number, mac_address, hostname, status, line_name } = req.body;
  try {
    const query = `
      INSERT INTO assets (node_id, serial_number, mac_address, hostname, status, line_name, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *;
    `;
    const values = [node_id, serial_number, mac_address, hostname, status || 'offline', line_name];
    const result = await db.query(query, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalQuery = await db.query('SELECT COUNT(*) FROM assets');
    const onlineQuery = await db.query("SELECT COUNT(*) FROM assets WHERE status = 'online'");
    const offlineQuery = await db.query("SELECT COUNT(*) FROM assets WHERE status = 'offline'");
    
    res.json({
      success: true,
      data: {
        total: parseInt(totalQuery.rows[0].count),
        online: parseInt(onlineQuery.rows[0].count),
        offline: parseInt(offlineQuery.rows[0].count),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};