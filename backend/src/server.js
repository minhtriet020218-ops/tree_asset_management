const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});