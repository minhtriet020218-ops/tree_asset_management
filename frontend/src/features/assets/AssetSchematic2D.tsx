import React from 'react';
import type { TreeNode, Asset } from '../../types/asset.types';

interface AssetSchematic2DProps {
  selectedTier: TreeNode | null;
  assets: Asset[];
  onBackToTree: () => void;
}

export const AssetSchematic2D: React.FC<AssetSchematic2DProps> = ({ selectedTier, assets, onBackToTree }) => {
  return (
    <div className="row g-4 animate__animated animate__fadeIn">
      {/* Header điều hướng */}
      <div className="col-12">
        <div className="d-flex align-items-center justify-content-between bg-white p-3 rounded shadow-sm border">
          <button className="btn btn-outline-dark btn-sm d-flex align-items-center fw-semibold px-3 shadow-sm" onClick={onBackToTree}>
            <i className="bi bi-arrow-left me-2"></i> Quay lại Cây Thông 3D
          </button>
          <div className="text-center">
            <h5 className="mb-0 text-success fw-bold">
              <i className="bi bi-tree-fill me-2"></i> {selectedTier?.name}
            </h5>
            <small className="text-muted">Sơ đồ sinh thái vẽ tay (Cành Line - Cành PC - Lá Monitor)</small>
          </div>
          <span className="badge bg-success px-3 py-2 shadow-sm">Trực quan sinh thái</span>
        </div>
      </div>

      {/* Cột Trái: Khu vực Sơ đồ Cành Cây Vẽ Tay Nghệ Thuật */}
      <div className="col-lg-7">
        <div className="card shadow-sm border-0 h-100">
          <div className="card-header bg-white fw-bold py-3 text-secondary border-bottom">
            <i className="bi bi-brush me-2 text-warning"></i> Sơ Đồ Cành Cây Thú Vị (Hand-drawn Sketch)
          </div>
          <div className="card-body bg-white p-3 d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '500px' }}>
            
            {/* Khung SVG vẽ tay cách điệu mượt mà */}
            <div className="w-100 position-relative border rounded p-2 bg-light shadow-inner">
              <svg width="100%" height="380" viewBox="0 0 600 400" className="w-100 h-auto">
                {/* --- GỐC VÀ CÀNH LỚN (MÀU CAM - LINE SẢN XUẤT) --- */}
                {/* Gốc cây chính từ dưới lên */}
                <path d="M 300 370 Q 300 320 300 270" fill="none" stroke="#e67e22" strokeWidth="16" strokeLinecap="round" />

                {/* Nhánh lớn bên trái */}
                <path d="M 300 270 Q 200 250 120 180" fill="none" stroke="#e67e22" strokeWidth="12" strokeLinecap="round" />
                {/* Nhánh lớn bên phải */}
                <path d="M 300 270 Q 400 250 480 180" fill="none" stroke="#e67e22" strokeWidth="12" strokeLinecap="round" />
                {/* Nhánh lớn ở giữa */}
                <path d="M 300 270 L 300 150" fill="none" stroke="#e67e22" strokeWidth="12" strokeLinecap="round" />


                {/* --- CÀNH NHỎ (MÀU NÂU - PC THIẾT BỊ) --- */}
                {/* Cành PC bên trái (Liền mạch - Online) */}
                <path d="M 150 205 L 100 150" fill="none" stroke="#854d0e" strokeWidth="6" strokeLinecap="round" />
                
                {/* Cành PC bên phải (Đứt gãy / Gãy khúc tượng trưng cho OFFLINE) */}
                <path d="M 450 205 L 490 160 L 510 130" fill="none" stroke="#c0392b" strokeWidth="6" strokeLinecap="round" strokeDasharray="5,3" />

                {/* Cành PC ở giữa */}
                <path d="M 300 180 L 260 120" fill="none" stroke="#854d0e" strokeWidth="6" strokeLinecap="round" />


                {/* --- LÁ CÂY (MONITOR: XANH = ONLINE, ĐỎ HÉO = OFFLINE) --- */}
                {/* Lá 1 (Xanh - Online) */}
                <g transform="translate(90, 130) rotate(-20)">
                  <ellipse cx="0" cy="0" rx="24" ry="12" fill="#2ecc71" stroke="#27ae60" strokeWidth="2" />
                  <path d="M -15 0 L 15 0" stroke="#fff" strokeWidth="1.5" />
                  <text x="-25" y="25" fontSize="11" fill="#27ae60" fontWeight="bold">Monitor 01 (Online)</text>
                </g>

                {/* Lá 2 (Xanh - Online ở giữa) */}
                <g transform="translate(250, 100) rotate(15)">
                  <ellipse cx="0" cy="0" rx="24" ry="12" fill="#2ecc71" stroke="#27ae60" strokeWidth="2" />
                  <path d="M -15 0 L 15 0" stroke="#fff" strokeWidth="1.5" />
                  <text x="-25" y="25" fontSize="11" fill="#27ae60" fontWeight="bold">PLC-Line (Online)</text>
                </g>

                {/* Lá 3 (Đỏ héo - Offline / Gãy cành) */}
                <g transform="translate(510, 110) rotate(35)">
                  {/* Hình chiếc lá rũ xuống, màu đỏ héo */}
                  <path d="M 0 0 Q 20 -20 35 -5 Q 15 20 0 0 Z" fill="#e74c3c" stroke="#c0392b" strokeWidth="2" />
                  <path d="M 0 0 L 20 -5" stroke="#f5b7b1" strokeWidth="1.5" />
                  <text x="-20" y="25" fontSize="11" fill="#c0392b" fontWeight="bold">Sensor (Offline / Gãy)</text>
                </g>
              </svg>
            </div>

            {/* Chú thích màu sắc sinh động */}
            <div className="mt-3 d-flex flex-wrap justify-content-center gap-3 text-secondary small bg-white px-3 py-2 rounded border shadow-sm w-100">
              <span><i className="bi bi-dash-lg text-warning fw-bold fs-5 me-1"></i> Cành cam: Line</span>
              <span><i className="bi bi-dash-lg text-brown fw-bold fs-5 me-1"></i> Cành nâu/gãy: PC</span>
              <span className="text-success fw-bold"><i className="bi bi-circle-fill me-1"></i> Lá xanh: Monitor Online</span>
              <span className="text-danger fw-bold"><i className="bi bi-circle-fill me-1"></i> Lá đỏ héo: Monitor Offline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cột Phải: Bảng chi tiết thông số tài sản */}
      <div className="col-lg-5">
        <div className="card shadow-sm border-0 h-100">
          <div className="card-header bg-white fw-bold py-3 text-primary border-bottom">
            <i className="bi bi-table me-2"></i> Bảng Thống Kê Chi Tiết Tầng Này
          </div>
          <div className="card-body p-3" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Thiết bị / Hostname</th>
                  <th>Line</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div className="fw-bold text-dark">{asset.hostname}</div>
                      <small className="text-muted font-monospace">{asset.serial_number}</small>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{asset.line_name}</span>
                    </td>
                    <td>
                      {asset.status === 'online' ? (
                        <span className="badge bg-success px-2 py-1">🌿 Lá Xanh (Online)</span>
                      ) : (
                        <span className="badge bg-danger px-2 py-1">🥀 Lá Đỏ Héo (Offline / Gãy)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};