const assetRepository = require('../repositories/assetRepository');
const hostnameService = require('./hostnameService');
const env = require('../config/env');

// Monitor không có hostname (không probe được, đi theo PC)
const isMonitor = (category) => /monitor|màn hình/i.test(category || '');

class AssetService {
  async getAssets(nodeId, status, search, includeChildren = true) {
    return await assetRepository.findAll(nodeId, status, search, includeChildren);
  }

  async createAsset(data) {
    const d = { ...data };
    const hostname = typeof d.hostname === 'string' ? d.hostname.trim() : '';
    // Để trống hostname -> hệ thống tự đặt: {CHI_NHÁNH}{YY}-{LINE}-{STT}
    if (!hostname && !isMonitor(d.category)) {
      d.hostname = await hostnameService.generate(d.node_id);
    }
    return await assetRepository.create(d, { graceDays: env.alerts.newAssetGraceDays });
  }

  async updateAsset(id, data) {
    return await assetRepository.update(id, data);
  }

  async deleteAsset(id) {
    return await assetRepository.delete(id);
  }

  async getMeta() {
    return await assetRepository.getMeta();
  }

  async getStats() {
    const rows = await assetRepository.countByStatus();
    const by = Object.fromEntries(rows.map((r) => [r.status, r.count]));
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { total, online: by.online || 0, offline: by.offline || 0 };
  }
}

module.exports = new AssetService();
