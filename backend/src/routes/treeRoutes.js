const express = require('express');
const router = express.Router();
const treeController = require('../controllers/treeController');

router.get('/', treeController.getTreeNodes);
router.post('/', treeController.createTreeNode);

module.exports = router;