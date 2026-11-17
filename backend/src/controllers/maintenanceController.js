const repo = require('../repositories/maintenanceRepository');

const SET_STATUSES = ['maintenance', 'online'];
const isId = (v) => /^\d+$/.test(String(v));
const text = (v) => (typeof v === 'string' ? v.trim() : '');

function fail(res, error) {
  console.error(error);
  res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
}

exports.list = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'ID thiết bị không hợp lệ' });
  try {
    res.json({ success: true, data: await repo.listByAsset(req.params.id) });
  } catch (error) {
    fail(res, error);
  }
};

exports.create = async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'ID thiết bị không hợp lệ' });

  const b = req.body || {};
  const description = text(b.description);
  const performedBy = text(b.performed_by);
  const bad = (message) => res.status(400).json({ success: false, message });

  if (!repo.TYPES.includes(b.type)) return bad(`type phải là một trong: ${repo.TYPES.join(', ')}`);
  if (!description) return bad('Vui lòng nhập nội dung bảo trì');
  if (description.length > 2000) return bad('Nội dung tối đa 2000 ký tự');
  if (performedBy.length > 200) return bad('Người thực hiện tối đa 200 ký tự');
  if (b.set_status && !SET_STATUSES.includes(b.set_status)) {
    return bad(`set_status phải là một trong: ${SET_STATUSES.join(', ')}`);
  }

  let performedAt = null;
  if (b.performed_at) {
    const d = new Date(b.performed_at);
    if (Number.isNaN(d.getTime())) return bad('performed_at không hợp lệ');
    performedAt = d.toISOString();
  }

  try {
    const data = await repo.create(req.params.id, {
      type: b.type,
      description,
      performed_by: performedBy,
      performed_at: performedAt,
      set_status: b.set_status || null,
    });
    if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy tài sản' });
    res.status(201).json({ success: true, data });
  } catch (error) {
    fail(res, error);
  }
};

exports.remove = async (req, res) => {
  if (!isId(req.params.id) || !isId(req.params.logId)) {
    return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
  }
  try {
    const deleted = await repo.delete(req.params.id, req.params.logId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Không tìm thấy dòng lịch sử' });
    res.json({ success: true });
  } catch (error) {
    fail(res, error);
  }
};