const assetRepository = require('../repositories/assetRepository');

class AssetService {
  async getAssets(nodeId, status, search, includeChildren = true) {
    return await assetRepository.findAll(nodeId, status, search, includeChildren);
  }

  async createAsset(data) {
    return await assetRepository.create(data);
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
    return { total, online: by.online || 0, offline: by.offline || 0, maintenance: by.maintenance || 0 };
  }
}

module.exports = new AssetService();