const assetService = require('../services/assetService');

exports.getAssets = async (req, res) => {
  try {
    const { node_id, status, search } = req.query;
    const data = await assetService.getAssets(node_id, status, search);
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const data = await assetService.createAsset(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await assetService.updateAsset(id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    await assetService.deleteAsset(id);
    res.json({ success: true, message: 'Asset liquidated / deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const assets = await assetService.getAssets();
    const total = assets.length;
    const online = assets.filter(a => a.status === 'online').length;
    const offline = assets.filter(a => a.status === 'offline').length;

    res.json({ success: true, data: { total, online, offline } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};