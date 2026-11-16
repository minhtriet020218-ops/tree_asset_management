const express = require('express');
const cors = require('cors');
const cron = require('node-cron'); // <-- 1. Import node-cron vào đây
const adSyncService = require('./services/adSyncService'); // <-- 2. Import service đồng bộ AD

const treeRoutes = require('./routes/treeRoutes');
const assetRoutes = require('./routes/assetRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.use('/api/tree', treeRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/reports', reportRoutes);

app.get('/', (req, res) => {
  res.send('Asset Management 3D Tree API is running...');
});

// --- 3. Đặt Cron Job chạy ngầm lúc 02:00 sáng mỗi ngày ở đây ---
cron.schedule('0 2 * * *', async () => {
  console.log('🔄 Đang tự động quét và đồng bộ dữ liệu từ Windows Domain...');
  try {
    await adSyncService.syncComputersToDatabase();
  } catch (error) {
    console.error('Lỗi cron job sync AD:', error);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});