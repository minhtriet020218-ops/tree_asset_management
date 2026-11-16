const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

router.get('/', syncController.getState);          // kết quả lần chạy gần nhất
router.post('/ad', syncController.runAd);          // chạy đồng bộ AD ngay
router.post('/status', syncController.runStatus);  // chạy kiểm tra online/offline ngay

module.exports = router;