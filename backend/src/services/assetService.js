const assetRepository = require('../repositories/assetRepository');
const hostnameService = require('./hostnameService');
const env = require('../config/env');

// Monitor không có hostname (không probe được, đi theo PC)
const isMonitor = (category) => /monitor|màn hình/i.test(category || '');
const isPrinter = (category) => /printer|máy in/i.test(category || '');

const bad = (message) => Object.assign(new Error(message), { status: 400 });
const toId = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
// "  line   1 " -> "line 1"
const cleanLine = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 100);
const sameLine = (a, b) => cleanLine(a).toLowerCase() === cleanLine(b).toLowerCase();

class AssetService {
  async getAssets(nodeId, status, search, includeChildren = true) {
    return await assetRepository.findAll(nodeId, status, search, includeChildren);
  }

  /** Tên line đã chuẩn hóa theo cách viết đang dùng nhiều nhất; để trống thì trả về null (= vào Kho). */
  async canonicalLine(raw) {
    const line = cleanLine(raw);
    if (!line) return null;
    return (await assetRepository.canonicalLine(line)) || line;
  }

  /**
   * Tạo mới. Điền đủ node + Line => vào thẳng line đó (tự phân loại, không cần kéo thả).
   * Thiếu node hoặc Line => nằm trong Kho, chờ IT biên chế.
   */
  async createAsset(data) {
    const d = { ...data };
    d.production_line = await this.canonicalLine(d.production_line);
    const hostname = typeof d.hostname === 'string' ? d.hostname.trim() : '';
    // Để trống hostname -> hệ thống tự đặt: {CHI_NHÁNH}{YY}-{LINE}-{STT}. Chưa có node (hàng mới về kho) thì
    // chưa đặt được; sẽ tự đặt khi thiết bị được biên chế vào line.
    if (!hostname && !isMonitor(d.category) && toId(d.node_id) !== null) {
      d.hostname = await hostnameService.generate(d.node_id);
    }
    return await assetRepository.create(d, { graceDays: env.alerts.newAssetGraceDays });
  }

  async updateAsset(id, data) {
    const d = { ...data, production_line: await this.canonicalLine(data.production_line) };
    return await assetRepository.update(id, d);
  }

  async getStock(search, limit) {
    const n = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
    return await assetRepository.findStock({ search: typeof search === 'string' ? search.trim() : '', limit: n });
  }

  /**
   * Biên chế thiết bị vào line (kéo từ Kho ra sơ đồ) hoặc trả về Kho (production_line trống).
   * body: { node_id, production_line, parent_asset_id? }
   *  - có production_line thì bắt buộc có node_id
   *  - parent_asset_id: chỉ dành cho màn hình, PC đó phải nằm trong cùng line (bỏ qua khi trả về Kho)
   */
  async placeAsset(id, body) {
    const asset = await assetRepository.findById(id);
    if (!asset) return null;

    const nodeId = toId(body.node_id);
    const parentId = toId(body.parent_asset_id);
    const line = await this.canonicalLine(body.production_line);
    // line_order: số thực (vị trí trong line) hoặc để trống = xếp theo tên
    let lineOrder = null;
    if (body.line_order !== undefined && body.line_order !== null && body.line_order !== '') {
      lineOrder = Number(body.line_order);
      if (!Number.isFinite(lineOrder) || Math.abs(lineOrder) > 1e9) throw bad('Thứ tự trong line không hợp lệ');
    }

    if (line && nodeId === null) throw bad('Cần chọn vị trí (node) khi gán thiết bị vào line');
    if (nodeId !== null && !(await assetRepository.nodeExists(nodeId))) throw bad('Không tìm thấy vị trí (node) đã chọn');
    // Trả về Kho (không có line) thì bỏ qua PC cha; chỉ kiểm tra PC khi thật sự gắn vào line
    if (parentId !== null && line) {
      if (!isMonitor(asset.category)) throw bad('Chỉ màn hình mới gắn vào PC được');
      const parent = await assetRepository.findById(parentId);
      if (!parent || parent.id === asset.id) throw bad('Không tìm thấy PC để gắn màn hình');
      if (isMonitor(parent.category) || isPrinter(parent.category)) throw bad('Màn hình chỉ gắn được vào PC');
      if (!sameLine(parent.production_line, line)) throw bad('PC được chọn không nằm trong line này');
    }

    // Thiết bị chưa có tên (hàng mới về kho) được đặt hostname ngay khi biên chế. Node chưa có mã thì bỏ qua, không chặn việc gán.
    let hostname = null;
    if (line && !asset.hostname && !isMonitor(asset.category)) {
      try {
        hostname = await hostnameService.generate(nodeId);
      } catch (e) {
        if (e.status !== 400 && e.code !== '22023') throw e;
      }
    }

    return await assetRepository.place(id, {
      nodeId,
      line,
      parentId: line ? parentId : null,
      hostname,
      lineOrder: line ? lineOrder : null,
      graceDays: env.alerts.newAssetGraceDays,
    });
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
