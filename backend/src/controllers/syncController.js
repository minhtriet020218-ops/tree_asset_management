const jobs = require('../services/syncJobs');

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