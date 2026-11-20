import type { Asset } from '../../types/asset.types';
import { isMonitor, isPrinter } from './assetUtils';

interface StockSidebarProps {
  items: Asset[];
  total: number;
  loaded: boolean;
  search: string;
  onSearch: (value: string) => void;
  onDragStart: (asset: Asset) => void;
  onDragEnd: () => void;
  onClose: () => void;
  /** Đang kéo 1 thiết bị từ sơ đồ 3D: Kho là vùng thả để trả thiết bị về Kho */
  moving?: boolean;
  /** Con trỏ đang ở trên Kho khi kéo từ sơ đồ */
  overStock?: boolean;
}

const iconOf = (a: Asset) => (isMonitor(a) ? 'bi-display' : isPrinter(a) ? 'bi-printer' : 'bi-pc-display');

/** Vì sao thiết bị này đang ở Kho */
const reasonOf = (a: Asset) => (a.node_id == null ? 'Chưa có vị trí' : 'Chưa có line');

/** Thanh Kho bên phải: thiết bị chưa biên chế vào line. Kéo thả ra khung line trên sơ đồ 3D để biên chế. */
export function StockSidebar({ items, total, loaded, search, onSearch, onDragStart, onDragEnd, onClose, moving, overStock }: StockSidebarProps) {
  return (
    <aside
      data-stock-drop
      className={`border-start d-flex flex-column ${overStock ? 'bg-warning-subtle' : 'bg-white'}`}
      style={{ width: 320, flexShrink: 0, outline: moving ? '3px dashed #f08c00' : undefined, outlineOffset: -3 }}
    >
      {moving && (
        <div className="text-center small fw-bold text-dark py-2 bg-warning">
          <i className="bi bi-box-arrow-in-down me-1"></i> Thả vào đây để trả thiết bị về Kho
        </div>
      )}
      <div className="p-3 border-bottom">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="fw-bold">
            <i className="bi bi-box-seam text-warning me-2"></i>Kho thiết bị
            <span className="badge bg-warning text-dark ms-2">{total}</span>
          </span>
          <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={onClose} title="Ẩn Kho">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <input
          className="form-control form-control-sm"
          placeholder="Tìm theo tên, mã, serial, loại..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <div className="small text-muted mt-2">
          <i className="bi bi-hand-index me-1"></i>
          Kéo thiết bị ra <strong>khung line</strong> để biên chế. Màn hình có thể thả lên một <strong>PC</strong> để gắn dây.
        </div>
      </div>

      <div className="flex-grow-1 overflow-auto p-2">
        {!loaded && <div className="text-center text-muted small py-4">Đang tải Kho...</div>}
        {loaded && items.length === 0 && (
          <div className="text-center text-muted small py-4">
            {search ? 'Không tìm thấy thiết bị phù hợp.' : 'Kho trống: mọi thiết bị đã được biên chế vào line.'}
          </div>
        )}
        {items.map((a) => (
          <div
            key={a.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', String(a.id)); // Firefox cần có dữ liệu mới cho kéo
              e.dataTransfer.effectAllowed = 'move';
              onDragStart(a);
            }}
            onDragEnd={onDragEnd}
            className="border rounded p-2 mb-2 d-flex align-items-start gap-2 bg-light"
            style={{ cursor: 'grab' }}
            title="Kéo ra sơ đồ để biên chế"
          >
            <i className={`bi ${iconOf(a)} fs-4 text-secondary`}></i>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="fw-bold small text-truncate">{a.hostname || a.it_asset_code}</div>
              <div className="small text-muted text-truncate">{[a.category, a.product].filter(Boolean).join(' • ') || '—'}</div>
              <div className="d-flex align-items-center gap-2 mt-1">
                <span className="badge bg-secondary">{reasonOf(a)}</span>
                <span className={`small ${a.status === 'online' ? 'text-success' : 'text-danger'}`}>
                  {a.status === 'online' ? '● online' : '● offline'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {loaded && total > items.length && (
        <div className="p-2 border-top small text-muted text-center">
          Hiển thị {items.length}/{total}: gõ vào ô tìm kiếm để thu hẹp
        </div>
      )}
    </aside>
  );
}
