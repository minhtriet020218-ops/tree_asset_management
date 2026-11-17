process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '16'; // phải đặt trước mọi require
const env = require('./config/env'); // nạp đầu tiên (dotenv + kiểm tra biến)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');

const jobs = require('./services/syncJobs');
const treeRoutes = require('./routes/treeRoutes');
const assetRoutes = require('./routes/assetRoutes');
const reportRoutes = require('./routes/reportRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origin không được phép'));
    },
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.send('Asset Management API is running...'));

app.use('/api/tree', treeRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sync', syncRoutes);

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
});

// --- Lịch chạy ---
// 1) Đồng bộ danh sách máy từ AD (mặc định 02:00 mỗi ngày)
if (env.ad.configured) {
  cron.schedule(env.schedule.adSync, () => jobs.runAdSync().catch(() => {}));
  if (env.ad.syncOnStart) jobs.runAdSync().catch(() => {});
} else {
  console.warn('Chưa cấu hình AD trong .env: bỏ qua đồng bộ AD.');
}

// 2) Kiểm tra online/offline (mặc định mỗi 5 phút)
cron.schedule(env.schedule.status, () => jobs.runStatusCheck().catch(() => {}));
setTimeout(() => jobs.runStatusCheck().catch(() => {}), 15000); // lần đầu sau khi khởi động

app.listen(env.port, () => console.log(`Server chạy tại http://localhost:${env.port}`));