const db = require('../config/db');
const treeRepository = require('../repositories/treeRepository');

exports.getTreeNodes = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tree_nodes ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getTreeStats = async (req, res) => {
  try {
    res.json({ success: true, data: await treeRepository.getStats() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createTreeNode = async (req, res) => {
  const { parent_id, name, code, node_type, description } = req.body;
  try {
    const query = `
      INSERT INTO tree_nodes (parent_id, name, code, node_type, description)
      VALUES ($1, $2, $3, $4, $5) RETURNING *;
    `;
    const values = [parent_id || null, name, code, node_type, description];
    const result = await db.query(query, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};