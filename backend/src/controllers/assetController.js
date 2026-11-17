const assetService = require('../services/assetService');

function fail(res, error) {
  // Lỗi dữ liệu đầu vào (vd: node chưa có code để đặt hostname) -> 400 kèm lý do cho người dùng
  if (error.status === 400 || error.code === '22023') {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(error);
  if (error.code === '23505') {
    return res.status(409).json({ success: false, message: 'Mã tài sản / hostname / serial đã tồn tại' });
  }
  res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
}

exports.getAssets = async (req, res) => {
  try {
    const { node_id, status, search, include_children } = req.query;
    const data = await assetService.getAssets(node_id, status, search, include_children !== 'false');
    res.json({ success: true, data });
  } catch (error) {
    fail(res, error);
  }
};

exports.getMeta = async (req, res) => {
  try {
    res.json({ success: true, data: await assetService.getMeta() });
  } catch (error) {
    fail(res, error);
  }
};

exports.createAsset = async (req, res) => {
  try {
    const data = await assetService.createAsset(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    fail(res, error);
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const data = await assetService.updateAsset(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy tài sản' });
    res.json({ success: true, data });
  } catch (error) {
    fail(res, error);
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const deleted = await assetService.deleteAsset(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Không tìm thấy tài sản' });
    res.json({ success: true, message: 'Asset liquidated / deleted successfully' });
  } catch (error) {
    fail(res, error);
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    res.json({ success: true, data: await assetService.getStats() });
  } catch (error) {
    fail(res, error);
  }
};
