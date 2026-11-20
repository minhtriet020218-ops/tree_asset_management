const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const maintenanceController = require('../controllers/maintenanceController');

router.get('/', assetController.getAssets);
router.get('/meta', assetController.getMeta);
router.get('/stock', assetController.getStock); // Kho: thiết bị chưa biên chế vào line
router.get('/dashboard/stats', assetController.getDashboardStats);
router.post('/', assetController.createAsset);
router.put('/:id', assetController.updateAsset);
router.patch('/:id/placement', assetController.placeAsset); // biên chế vào line / trả về kho
router.delete('/:id', assetController.deleteAsset);

// Lịch sử bảo trì của 1 thiết bị
router.get('/:id/maintenance', maintenanceController.list);
router.post('/:id/maintenance', maintenanceController.create);
router.delete('/:id/maintenance/:logId', maintenanceController.remove);

module.exports = router;
