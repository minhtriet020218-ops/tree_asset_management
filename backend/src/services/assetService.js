const assetRepository = require('../repositories/assetRepository');

class AssetService {
  async getAssets(nodeId, status, search) {
    return await assetRepository.findAll(nodeId, status, search);
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
}

module.exports = new AssetService();