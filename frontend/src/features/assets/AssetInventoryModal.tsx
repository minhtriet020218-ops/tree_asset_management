import React, { useState } from 'react';
import type { TreeNode, Asset } from '../../types/asset.types';

interface AssetInventoryProps {
  selectedTier: TreeNode | null;
  assets: Asset[];
  onBack: () => void;
  onAddAsset: (newAsset: Partial<Asset>) => void;
  onUpdateAsset: (updatedAsset: Asset) => void;
  onDeleteAssets: (assetIds: number[]) => void;
}

export const AssetInventoryModal: React.FC<AssetInventoryProps> = ({
  selectedTier,
  assets,
  onBack,
  onAddAsset,
  onUpdateAsset,
  onDeleteAssets,
}) => {
  const [searchField, setSearchField] = useState('IT ASSET-CODE');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  
  // State quản lý Modal Form (Create / Edit)
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State đầy đủ các trường doanh nghiệp
  const [formData, setFormData] = useState<Partial<Asset>>({
    it_asset_code: '',
    hostname: '',
    category: '',
    product: '',
    production_line: '',
    finance_asset_code: '',
    po_invoice: '',
    serial_number: '',
    status: 'online',
  });

  // Xử lý chọn checkbox
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedAssetIds(assets.map((a) => a.id));
    } else {
      setSelectedAssetIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Mở modal Thêm mới
  const handleOpenCreate = () => {
    setIsEditing(false);
    setFormData({
      it_asset_code: `VN-${Math.floor(1000 + Math.random() * 9000)}`,
      hostname: '',
      category: 'Laptop',
      product: '',
      production_line: selectedTier?.name || 'Line SMT 01',
      finance_asset_code: '',
      po_invoice: '',
      serial_number: '',
      status: 'online',
    });
    setShowModal(true);
  };

  // Mở modal Chỉnh sửa (lấy tài sản đầu tiên được chọn)
  const handleOpenEdit = () => {
    if (selectedAssetIds.length !== 1) {
      alert('Vui lòng chọn chính xác 1 tài sản để chỉnh sửa!');
      return;
    }
    const target = assets.find((a) => a.id === selectedAssetIds[0]);
    if (target) {
      setIsEditing(true);
      setFormData(target);
      setShowModal(true);
    }
  };

  // Lưu Form (Thêm hoặc Sửa)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && formData.id) {
      onUpdateAsset(formData as Asset);
    } else {
      onAddAsset({
        ...formData,
        node_id: selectedTier?.id || 1,
        last_seen_at: new Date().toISOString().split('T')[0],
      });
    }
    setShowModal(false);
  };

  // Xóa / Thanh lý tài sản (Asset Liquidation)
  const handleLiquidation = () => {
    if (selectedAssetIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 tài sản để thanh lý/xóa!');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn thanh lý/xóa ${selectedAssetIds.length} tài sản đã chọn không?`)) {
      onDeleteAssets(selectedAssetIds);
      setSelectedAssetIds([]);
    }
  };

  // Lọc dữ liệu
  const filteredAssets = assets.filter((asset) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    switch (searchField) {
      case 'IT ASSET-CODE':
        return asset.it_asset_code?.toLowerCase().includes(term);
      case 'Hostname':
        return asset.hostname?.toLowerCase().includes(term);
      case 'Serial Number':
        return asset.serial_number?.toLowerCase().includes(term);
      case 'Production Line':
        return asset.production_line?.toLowerCase().includes(term);
      default:
        return asset.it_asset_code?.toLowerCase().includes(term);
    }
  });

  return (
    <div className="card shadow-sm border-0">
      {/* Header điều hướng */}
      <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
        <button className="btn btn-outline-dark btn-sm d-flex align-items-center gap-1" onClick={onBack}>
          <i className="bi bi-arrow-left"></i> Quay lại Sơ đồ React Flow
        </button>
        <span className="fw-bold text-success">
          <i className="bi bi-building me-2"></i> Khu vực quản lý: {selectedTier?.name}
        </span>
        <span className="badge bg-primary">Tổng số: {assets.length} tài sản</span>
      </div>

      <div className="card-body bg-light">
        {/* --- THANH THAO TÁC (ACTIONS BAR) --- */}
        <div className="card shadow-sm p-3 mb-3 border-0 bg-white">
          <div className="text-secondary small fw-bold mb-2">Thao tác</div>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-success btn-sm d-flex align-items-center gap-1" onClick={handleOpenCreate}>
              <i className="bi bi-plus-lg"></i> Create New
            </button>
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={handleOpenEdit}>
              <i className="bi bi-pencil-square"></i> Edit
            </button>
            <button className="btn btn-secondary btn-sm d-flex align-items-center gap-1">
              <i className="bi bi-tools"></i> Sửa hàng loạt
            </button>
            <button className="btn btn-info btn-sm text-white d-flex align-items-center gap-1">
              <i className="bi bi-clock-history"></i> History
            </button>
            <button className="btn btn-warning btn-sm text-dark d-flex align-items-center gap-1">
              <i className="bi bi-printer"></i> In mã tài sản
            </button>
            <button className="btn btn-success btn-sm d-flex align-items-center gap-1">
              <i className="bi bi-file-earmark-text"></i> Bàn giao
            </button>
            <button className="btn btn-info btn-sm text-white d-flex align-items-center gap-1" style={{ backgroundColor: '#0dcaf0', border: 'none' }}>
              <i className="bi bi-arrow-counterclockwise"></i> Thu hồi
            </button>
            <button className="btn btn-info btn-sm text-white d-flex align-items-center gap-1" style={{ backgroundColor: '#00bcd4' }}>
              <i className="bi bi-arrow-repeat"></i> Sync to Freshservice
            </button>
            <button className="btn btn-info btn-sm text-white d-flex align-items-center gap-1" style={{ backgroundColor: '#17a2b8' }}>
              <i className="bi bi-file-excel"></i> Xuất nhập dữ liệu
            </button>
            {/* Nút Xóa / Thanh lý tài sản */}
            <button className="btn btn-danger btn-sm d-flex align-items-center gap-1" onClick={handleLiquidation}>
              <i className="bi bi-trash"></i> Asset Liquidation
            </button>
          </div>
        </div>

        {/* --- THANH TÌM KIẾM --- */}
        <div className="card shadow-sm p-3 mb-3 border-0 bg-white">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="input-group" style={{ width: '220px' }}>
              <select 
                className="form-select form-select-sm fw-bold text-secondary"
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
              >
                <option value="IT ASSET-CODE">IT ASSET-CODE</option>
                <option value="Hostname">Hostname</option>
                <option value="Serial Number">Serial Number</option>
                <option value="Production Line">Production Line</option>
              </select>
            </div>
            <div className="flex-grow-1" style={{ minWidth: '220px' }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Gõ từ khóa tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-sm px-3 d-flex align-items-center gap-1">
              <i className="bi bi-search"></i> Lọc
            </button>
            <button className="btn btn-secondary btn-sm px-3" onClick={() => setSearchTerm('')}>
              Xóa lọc
            </button>
          </div>
        </div>

        {/* --- BẢNG HIỂN THỊ DỮ LIỆU --- */}
        <div className="table-responsive bg-white rounded shadow-sm border" style={{ maxHeight: '550px', overflowY: 'auto' }}>
          <table className="table table-hover align-middle mb-0 text-nowrap" style={{ fontSize: '12.5px' }}>
            <thead className="table-light sticky-top">
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    onChange={handleSelectAll}
                    checked={selectedAssetIds.length === assets.length && assets.length > 0}
                  />
                </th>
                <th>IT ASSET-CODE</th>
                <th>Hostname</th>
                <th>Category</th>
                <th>Product</th>
                <th>Production Line</th>
                <th>Finance Asset Code</th>
                <th>PO/Invoice</th>
                <th>Serial Number</th>
                <th>MAC Address</th>
                <th>Asset Status</th>
                <th>Assigned To</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const isChecked = selectedAssetIds.includes(asset.id);
                  return (
                    <tr key={asset.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isChecked}
                          onChange={() => handleSelectOne(asset.id)}
                        />
                      </td>
                      <td><span className="font-monospace text-primary fw-bold">{asset.it_asset_code}</span></td>
                      <td className="fw-bold text-dark">{asset.hostname}</td>
                      <td>{asset.category}</td>
                      <td>{asset.product}</td>
                      <td><span className="badge bg-secondary">{asset.production_line}</span></td>
                      <td><span className="font-monospace">{asset.finance_asset_code}</span></td>
                      <td><span className="font-monospace">{asset.po_invoice}</span></td>
                      <td><span className="font-monospace text-success">{asset.serial_number}</span></td>
                      <td><span className="font-monospace text-secondary">{asset.mac_address || 'N/A'}</span></td> {/* <-- Hiển thị MAC */}
                      <td>
                        {asset.status === 'online' ? (
                          <span className="badge bg-success px-2 py-1">In Use</span>
                        ) : (
                          <span className="badge bg-danger px-2 py-1">Offline</span>
                        )}
                      </td>
                      <td className="fw-bold">NGUYỄN THỊ NGỌC HUYỀN EM</td>
                      <td>PMC</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="text-center py-4 text-muted">
                    Không tìm thấy tài sản phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL ADD NEW / EDIT ASSET (Form như hình mẫu) --- */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark">
                  {isEditing ? 'Edit Asset' : 'Add New Asset'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmitForm}>
                <div className="modal-body row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Asset Code</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.it_asset_code || ''}
                      onChange={(e) => setFormData({ ...formData, it_asset_code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Staff Code</label>
                    <input type="text" className="form-control" placeholder="VN2616173" />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Hostname</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.hostname || ''}
                      onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Assigned To</label>
                    <input type="text" className="form-control" defaultValue="NGUYỄN THỊ NGỌC HUYỀN EM" />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Category</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Mail User</label>
                    <input type="email" className="form-control" defaultValue="ntnhem@xppower.com" />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Finance Code</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.finance_asset_code || ''}
                      onChange={(e) => setFormData({ ...formData, finance_asset_code: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Department</label>
                    <select className="form-select">
                      <option value="PMC">PMC</option>
                      <option value="IT">IT Department</option>
                      <option value="Production">Production</option>
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.serial_number || ''}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Product</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.product || ''}
                      onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold">PO/Invoice</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.po_invoice || ''}
                      onChange={(e) => setFormData({ ...formData, po_invoice: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Status</label>
                    <select
                      className="form-select"
                      value={formData.status || 'online'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="online">In Use (Online)</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Production Line</label>
                    <select
                      className="form-select"
                      value={formData.production_line || ''}
                      onChange={(e) => setFormData({ ...formData, production_line: e.target.value })}
                    >
                      <option value="Line SMT 01">Line SMT 01</option>
                      <option value="Line Lắp Ráp 02">Line Lắp Ráp 02</option>
                      <option value="Line Đóng Gói 03">Line Đóng Gói 03</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm px-4" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm px-4">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};