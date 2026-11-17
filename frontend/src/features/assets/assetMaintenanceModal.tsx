import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import type { Asset } from '../../types/asset.types';
import { MAINTENANCE_TYPES } from '../../types/maintenance.types';
import type { MaintenanceLog, MaintenanceType } from '../../types/maintenance.types';
import { maintenanceService } from '../../services/maintenanceService';

interface Props {
  asset: Asset;
  onClose: () => void;
  /** Gọi sau khi thêm/xóa lịch sử (vd: để tải lại danh sách thiết bị nếu trạng thái đã đổi) */
  onChanged?: () => void;
}

const typeLabel = (value: string) => MAINTENANCE_TYPES.find((t) => t.value === value)?.label ?? value;
const fmt = (iso: string) => new Date(iso).toLocaleString('vi-VN');

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
  }
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
}

export const AssetMaintenanceModal = ({ asset, onClose, onChanged }: Props) => {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<MaintenanceType>('repair');
  const [description, setDescription] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [performedAt, setPerformedAt] = useState('');
  const [muteHours, setMuteHours] = useState<number | ''>('');

  const load = useCallback(async () => {
    try {
      setLogs(await maintenanceService.list(asset.id));
      setError(null);
    } catch {
      setError('Không tải được lịch sử bảo trì.');
    } finally {
      setLoading(false);
    }
  }, [asset.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Nhấn Esc để đóng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Chặn click lan lên modal cha; bấm vào nền tối thì đóng
  const handleBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await maintenanceService.create(asset.id, {
        type,
        description: description.trim(),
        performed_by: performedBy.trim() || undefined,
        performed_at: performedAt ? new Date(performedAt).toISOString() : undefined,
        mute_hours: muteHours || undefined,
      });
      setDescription('');
      setPerformedBy('');
      setPerformedAt('');
      setMuteHours('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (log: MaintenanceLog) => {
    if (!window.confirm('Xóa dòng lịch sử này?')) return;
    try {
      await maintenanceService.remove(asset.id, log.id);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Render ra document.body (portal) để không bị modal cha che hoặc chặn click
  return createPortal(
    <div
      className="modal d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 }}
      onClick={handleBackdrop}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-clock-history me-2"></i>
              Lịch sử bảo trì — {asset.hostname || asset.it_asset_code}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Đóng"></button>
          </div>

          <div className="modal-body">
            {error && <div className="alert alert-danger py-2">{error}</div>}

            <form className="row g-2 mb-4" onSubmit={handleSubmit}>
              <div className="col-md-4">
                <label className="form-label small fw-bold">Loại</label>
                <select className="form-select" value={type} onChange={(e) => setType(e.target.value as MaintenanceType)}>
                  {MAINTENANCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-bold">Người thực hiện</label>
                <input className="form-control" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-bold">Thời điểm (mặc định: bây giờ)</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-bold">Nội dung *</label>
                <textarea
                  className="form-control"
                  rows={2}
                  required
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="col-md-8">
                <label className="form-label small fw-bold">Cảnh báo offline</label>
                <select
                  className="form-select"
                  value={muteHours}
                  onChange={(e) => setMuteHours(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Giữ nguyên</option>
                  <option value={4}>Tạm tắt 4 giờ</option>
                  <option value={24}>Tạm tắt 1 ngày</option>
                  <option value={72}>Tạm tắt 3 ngày</option>
                  <option value={168}>Tạm tắt 7 ngày</option>
                </select>
                <div className="form-text">Tự bật lại khi máy online. Trạng thái online/offline vẫn do hệ thống kiểm tra.</div>
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <button type="submit" className="btn btn-primary w-100" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Thêm vào lịch sử'}
                </button>
              </div>
            </form>

            {loading ? (
              <div className="text-muted">Đang tải...</div>
            ) : logs.length === 0 ? (
              <div className="text-muted">Chưa có lịch sử bảo trì.</div>
            ) : (
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Loại</th>
                    <th>Nội dung</th>
                    <th>Người thực hiện</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-nowrap">{fmt(log.performed_at)}</td>
                      <td><span className="badge bg-light text-dark border">{typeLabel(log.type)}</span></td>
                      <td style={{ whiteSpace: 'pre-wrap' }}>{log.description}</td>
                      <td>{log.performed_by ?? ''}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(log)} title="Xóa">
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
