const jobs = require('../services/syncJobs');
const alertService = require('../services/alertService');

exports.getState = (req, res) => {
  res.json({ success: true, data: jobs.getState() });
};

exports.runAd = async (req, res) => {
  try {
    res.json({ success: true, data: await jobs.runAdSync() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.runStatus = async (req, res) => {
  try {
    res.json({ success: true, data: await jobs.runStatusCheck() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Gửi tin thử để kiểm tra cấu hình Teams / email
exports.testAlert = async (req, res) => {
  try {
    await alertService.sendTest();
    res.json({ success: true, message: 'Đã gửi tin nhắn thử' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};