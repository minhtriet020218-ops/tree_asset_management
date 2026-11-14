import React, { useState } from 'react';
import { ThreePineTree } from './features/tree-3d/components/ThreePineTree';
import { AssetSchematicReactFlow } from './features/assets/AssetSchematicReactFlow';
import type { TreeNode, Asset } from './types/asset.types';

function App() {
  const [currentView, setCurrentView] = useState<'3d-tree' | '2d-schematic'>('3d-tree');
  const [selectedTier, setSelectedTier] = useState<TreeNode | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Xử lý khi click vào tầng 3D -> Sinh ra 3 Line, mỗi Line 6 Asset
  const handleSelectTier = (node: TreeNode) => {
    setSelectedTier(node);
    setCurrentView('2d-schematic');

    // Tạo dữ liệu giả lập lớn: 3 Line, mỗi Line có 6 thiết bị
    const mockAssets: Asset[] = [];
    const lineNames = ['Line SMT 01', 'Line Lắp Ráp 02', 'Line Đóng Gói 03'];

    let idCounter = 1;
    lineNames.forEach((lineName, lineIdx) => {
      for (let i = 1; i <= 6; i++) {
        // Cho ngẫu nhiên vài máy bị offline (lá đỏ héo, cành gãy) để test giao diện
        const isOffline = (lineIdx === 0 && i === 3) || (lineIdx === 1 && i === 5) || (lineIdx === 2 && i === 2);
        
        mockAssets.push({
          id: idCounter,
          node_id: node.id,
          serial_number: `SN-DEV-${100 + idCounter}`,
          mac_address: `00:11:22:33:44:${idCounter < 10 ? '0' + idCounter : idCounter}`,
          hostname: `${lineName.replace(/\s+/g, '').toUpperCase()}-PC0${i}`,
          status: isOffline ? 'offline' : 'online',
          line_name: lineName,
          last_seen_at: '2026-11-14',
        });
        idCounter++;
      }
    });

    setAssets(mockAssets);
  };

  return (
    <div className="min-vh-100 bg-light pb-5">
      {/* Thanh tiêu đề hệ thống */}
      <nav className="navbar navbar-dark bg-dark shadow-sm px-4 mb-4">
        <span className="navbar-brand mb-0 h1">
          <i className="bi bi-tree-fill text-success me-2"></i> 
          Hệ Thống Quản Lý Tài Sản (3D Pine Tree & React Flow Eco-Schematic)
        </span>
      </nav>

      <div className="container-fluid px-4">
        {currentView === '3d-tree' ? (
          /* MÀN HÌNH 1: CÂY THÔNG 3D PHÂN TẦNG */
          <div className="row justify-content-center">
            <div className="col-lg-7">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white fw-bold py-3 text-success d-flex justify-content-between align-items-center">
                  <span><i className="bi bi-box-seam me-2"></i> Mô Hình Cây Thông 3D (Phân tầng quản lý)</span>
                  <span className="badge bg-success">Click vào tầng để xem sơ đồ 2D</span>
                </div>
                <div className="card-body p-0 bg-white rounded-bottom">
                  <ThreePineTree onSelectTier={handleSelectTier} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* MÀN HÌNH 2: SƠ ĐỒ SINH THÁI 2D (REACT FLOW) */
          <div>
            <AssetSchematicReactFlow 
              selectedTier={selectedTier} 
              assets={assets}
              onBack={() => setCurrentView('3d-tree')} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;