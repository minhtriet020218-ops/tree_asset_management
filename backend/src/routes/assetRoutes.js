const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');

router.get('/', assetController.getAssets);
router.post('/', assetController.createAsset);
router.get('/dashboard/stats', assetController.getDashboardStats);

module.exports = router;