import React, { useEffect, useState } from 'react';
import type { TreeNode, Asset, AssetMeta } from '../../types/asset.types';
import { assetService } from '../../services/assetService';
import { isMonitor } from './assetUtils';
import { AssetMaintenanceModal } from './AssetMaintenanceModal';

interface AssetInventoryProps {
  selectedTier: TreeNode | null;
  assets: Asset[];
  onBack: () => void;
  onAddAsset: (newAsset: Partial<Asset>) => void;
  onUpdateAsset: (updatedAsset: Asset) => void;
  onDeleteAssets: (assetIds: number[]) => void;
}

type TextKey =
  | 'it_asset_code' | 'hostname' | 'category' | 'product' | 'production_line'
  | 'finance_asset_code' | 'po_invoice' | 'serial_number' | 'mac_address'
  | 'assigned_to' | 'staff_code' | 'mail_user' | 'department';

const SEARCH_FIELDS: { label: string; key: TextKey }[] = [
  { label: 'IT ASSET-CODE', key: 'it_asset_code' },
  { label: 'Hostname', key: 'hostname' },
  { label: 'Serial Number', key: 'serial_number' },
  { label: 'Production Line', key: 'production_line' },
  { label: 'Assigned To', key: 'assigned_to' },
  { label: 'Department', key: 'department' },
];

const emptyForm = (lineName: string): Partial<Asset> => ({
  it_asset_code: '',
  hostname: '',
  category: 'PC',
  product: '',
  production_line: lineName,
  finance_asset_code: '',
  po_invoice: '',
  serial_number: '',
  mac_address: '',
  assigned_to: '',
  staff_code: '',
  mail_user: '',
  department: '',
  parent_asset_id: null,
  status: 'online',
});

export const AssetInventoryModal: React.FC<AssetInventoryProps> = ({
  selectedTier,
  assets,
  onBack,
  onAddAsset,
  onUpdateAsset,
  onDeleteAssets,
}) => {
  const [searchField, setSearchField] = useState<TextKey>('it_asset_code');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Asset>>(emptyForm(''));
  const [meta, setMeta] = useState<AssetMeta>({ lines: [], departments: [], categories: [] });

  // Danh sách line / phòng ban / loại thiết bị lấy từ DB (tải lại mỗi lần mở form)
  useEffect(() => {
    if (!showModal) return;
    assetService.getMeta().then(setMeta).catch(() => { /* form vẫn nhập tay được */ });
  }, [showModal]);

  const filteredAssets = assets.filter((asset) => {
    if (!searchTerm) return true;
    const value = asset[searchField];
    return (value ?? '').toString().toLowerCase().includes(searchTerm.toLowerCase());
  });

  const allFilteredSelected =
    filteredAssets.length > 0 && filteredAssets.every((a) => selectedAssetIds.includes(a.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ids = filteredAssets.map((a) => a.id);
    setSelectedAssetIds((prev) =>
      e.target.checked ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id)),
    );
  };

  const handleSelectOne = (id: number) => {
    setSelectedAssetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setFormData(emptyForm(selectedTier?.name || ''));
    setShowModal(true);
  };

  const handleOpenEdit = () => {
    if (selectedAssetIds.length !== 1) {
      alert('Vui lòng chọn chính xác 1 tài sản để chỉnh sửa!');
      return;
    }
    const target = assets.find((a) => a.id === selectedAssetIds[0]);
    if (target) {
      setIsEditing(true);
      setFormData({ ...target });
      setShowModal(true);
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && formData.id) {
      onUpdateAsset(formData as Asset);
    } else {
      onAddAsset({ ...formData, node_id: selectedTier?.id });
    }
    setShowModal(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await assetService.exportAssets({ nodeId: selectedTier?.id });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

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

  const handleOpenHistory = () => {
    if (selectedAssetIds.length !== 1) {
      alert('Vui lòng chọn chính xác 1 tài sản để xem lịch sử!');
      return;
    }
    setHistoryAsset(assets.find((a) => a.id === selectedAssetIds[0]) ?? null);
  };

  const setText = (key: TextKey, value: string) => setFormData((prev) => ({ ...prev, [key]: value }));

  // Ô nhập văn bản (có thể kèm gợi ý datalist)
  const textField = (label: string, key: TextKey, opts: { required?: boolean; list?: string; placeholder?: string; type?: string } = {}) => (
    <div className="col-md-6">
      <label className="form-label small fw-bold">{label}</label>
      <input
        type={opts.type || 'text'}
        className="form-control"
        list={opts.list}
        placeholder={opts.placeholder}
        required={opts.required}
        value={(formData[key] as string | null | undefined) ?? ''}
        onChange={(e) => setText(key, e.target.value)}
      />
    </div>
  );

  const formIsMonitor = isMonitor(formData as Asset);
  const parentCandidates = assets.filter((a) => !isMonitor(a) && a.id !== formData.id);

  return (
    <div className="card shadow-sm border-0">
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
        {/* --- THANH THAO TÁC --- */}
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
            <button className="btn btn-info btn-sm text-white d-flex align-items-center gap-1" onClick={handleOpenHistory}>
              {historyAsset && (
                <AssetMaintenanceModal key={historyAsset.id} asset={historyAsset} onClose={() => setHistoryAsset(null)} />
              )}
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
            <button
              className="btn btn-info btn-sm text-white d-flex align-items-center gap-1"
              style={{ backgroundColor: '#17a2b8' }}
              onClick={handleExport}
              disabled={exporting}
            >
              <i className="bi bi-file-excel"></i> {exporting ? 'Đang xuất...' : 'Xuất nhập dữ liệu'}
            </button>
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
                onChange={(e) => setSearchField(e.target.value as TextKey)}
              >
                {SEARCH_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
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
            <button className="btn btn-secondary btn-sm px-3" onClick={() => setSearchTerm('')}>
              Xóa lọc
            </button>
            <span className="text-muted small">Hiển thị {filteredAssets.length}/{assets.length}</span>
          </div>
        </div>

        {/* --- BẢNG DỮ LIỆU --- */}
        <div className="table-responsive bg-white rounded shadow-sm border" style={{ maxHeight: '550px', overflowY: 'auto' }}>
          <table className="table table-hover align-middle mb-0 text-nowrap" style={{ fontSize: '12.5px' }}>
            <thead className="table-light sticky-top">
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" className="form-check-input" onChange={handleSelectAll} checked={allFilteredSelected} />
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
                filteredAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedAssetIds.includes(asset.id)}
                        onChange={() => handleSelectOne(asset.id)}
                      />
                    </td>
                    <td><span className="font-monospace text-primary fw-bold">{asset.it_asset_code}</span></td>
                    <td className="fw-bold text-dark">{asset.hostname || '—'}</td>
                    <td>{asset.category}</td>
                    <td>{asset.product}</td>
                    <td><span className="badge bg-secondary">{asset.production_line}</span></td>
                    <td><span className="font-monospace">{asset.finance_asset_code}</span></td>
                    <td><span className="font-monospace">{asset.po_invoice}</span></td>
                    <td><span className="font-monospace text-success">{asset.serial_number}</span></td>
                    <td><span className="font-monospace text-secondary">{asset.mac_address || 'N/A'}</span></td>
                    <td>
                      {asset.status === 'online' ? (
                        <span className="badge bg-success px-2 py-1">In Use</span>
                      ) : asset.status === 'maintenance' ? (
                        <span className="badge bg-warning text-dark px-2 py-1">Maintenance</span>
                      ) : (
                        <span className="badge bg-danger px-2 py-1">Offline</span>
                      )}
                    </td>
                    <td className="fw-bold">{asset.assigned_to || <span className="text-muted fw-normal">—</span>}</td>
                    <td>{asset.department || <span className="text-muted">—</span>}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13} className="text-center py-4 text-muted">
                    Không tìm thấy tài sản phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL THÊM / SỬA --- */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmitForm}>
                <div className="modal-body row g-3">
                  {textField('Asset Code', 'it_asset_code', { placeholder: 'Để trống để hệ thống tự tạo' })}
                  {textField('Staff Code', 'staff_code')}

                  {textField('Hostname', 'hostname', { required: !formIsMonitor })}
                  {textField('Assigned To', 'assigned_to')}

                  {textField('Category', 'category', { list: 'dl-categories' })}
                  {textField('Mail User', 'mail_user', { type: 'email' })}

                  {textField('Finance Code', 'finance_asset_code')}
                  {textField('Department', 'department', { list: 'dl-departments' })}

                  {textField('Serial Number', 'serial_number')}
                  {textField('Product', 'product')}

                  {textField('PO/Invoice', 'po_invoice')}
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Status</label>
                    <select
                      className="form-select"
                      value={formData.status || 'online'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Asset['status'] }))}
                    >
                      <option value="online">In Use (Online)</option>
                      <option value="offline">Offline</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>

                  {textField('Production Line', 'production_line', { list: 'dl-lines' })}
                  {textField('MAC Address', 'mac_address')}

                  {formIsMonitor && (
                    <div className="col-12">
                      <label className="form-label small fw-bold">Gắn với PC</label>
                      <select
                        className="form-select"
                        value={formData.parent_asset_id ?? ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, parent_asset_id: e.target.value ? Number(e.target.value) : null }))
                        }
                      >
                        <option value="">— Chưa gắn —</option>
                        {parentCandidates.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.hostname || a.it_asset_code} ({a.it_asset_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <datalist id="dl-categories">{meta.categories.map((v) => <option key={v} value={v} />)}</datalist>
                  <datalist id="dl-departments">{meta.departments.map((v) => <option key={v} value={v} />)}</datalist>
                  <datalist id="dl-lines">{meta.lines.map((v) => <option key={v} value={v} />)}</datalist>
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
