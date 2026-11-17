const adSyncService = require('./adSyncService');
const statusCheckService = require('./statusCheckService');
const alertService = require('./alertService');

const state = { ad: null, status: null };

// Bọc job: chống chạy chồng + lưu kết quả lần chạy gần nhất
function guard(name, fn) {
  let running = false;
  return async () => {
    if (running) {
      console.warn(`Job "${name}" lượt trước chưa xong, bỏ qua.`);
      return { skipped: true };
    }
    running = true;
    const startedAt = new Date();
    try {
      const result = await fn();
      state[name] = { startedAt, finishedAt: new Date(), ok: true, result };
      return result;
    } catch (err) {
      console.error(`Job "${name}" lỗi:`, err.message);
      state[name] = { startedAt, finishedAt: new Date(), ok: false, error: err.message };
      throw err;
    } finally {
      running = false;
    }
  };
}

module.exports = {
  runAdSync: guard('ad', () => adSyncService.syncComputersToDatabase()),
  runStatusCheck: guard('status', async () => {
    const result = await statusCheckService.checkAll();
    // Lỗi gửi cảnh báo không được làm hỏng kết quả kiểm tra trạng thái
    try {
      result.alerts = await alertService.run();
    } catch (err) {
      console.error('Gửi cảnh báo lỗi:', err.message);
      result.alerts = { error: err.message };
    }
    return result;
  }),
  getState: () => state,
};