import { useState } from 'react';
import { ThreePineTree } from './features/tree-3d/components/ThreePineTree';
import { AssetSchematic3D } from './features/assets/AssetSchematic3D';
import { AssetInventoryModal } from './features/assets/AssetInventoryModal';
import { assetService } from './services/assetService';
import type { TreeNode, Asset } from './types/asset.types';

function App() {
  const [currentView, setCurrentView] = useState<'3d-tree' | 'schematic' | 'inventory'>('3d-tree');
  const [selectedTier, setSelectedTier] = useState<TreeNode | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Khi click chọn tầng trên cây 3D -> Gọi API lấy danh sách tài sản thực tế từ Database theo node_id
  const handleSelectTier = async (node: TreeNode) => {
    setSelectedTier(node);
    setCurrentView('schematic');
    try {
      const data = await assetService.getAssets(node.id);
      setAssets(data);
    } catch (error) {
      console.error("Lỗi khi tải danh sách tài sản từ API:", error);
    }
  };

  // Tải lại danh sách tài sản của tầng đang xem (sau khi biên chế thiết bị từ Kho vào line)
  const refreshAssets = async () => {
    if (!selectedTier) return;
    try {
      setAssets(await assetService.getAssets(selectedTier.id));
    } catch (error) {
      console.error("Lỗi khi tải lại danh sách tài sản:", error);
    }
  };

  const handleAddAsset = async (newAsset: Partial<Asset>) => {
    try {
      const created = await assetService.createAsset({ ...newAsset, node_id: selectedTier?.id });
      setAssets([created, ...assets]);
    } catch (error) {
      console.error("Lỗi thêm tài sản:", error);
    }
  };

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    try {
      const updated = await assetService.updateAsset(updatedAsset.id, updatedAsset);
      setAssets(assets.map((a) => (a.id === updated.id ? updated : a)));
    } catch (error) {
      console.error("Lỗi cập nhật tài sản:", error);
    }
  };

  const handleDeleteAssets = async (assetIds: number[]) => {
    try {
      for (const id of assetIds) {
        await assetService.deleteAsset(id);
      }
      setAssets(assets.filter((a) => !assetIds.includes(a.id)));
    } catch (error) {
      console.error("Lỗi xóa/thanh lý tài sản:", error);
    }
  };

  return (
    <div className="min-vh-100 bg-light pb-5">
      <nav className="navbar navbar-dark bg-dark shadow-sm px-4 mb-4 d-flex justify-content-between">
        <span className="navbar-brand mb-0 h1">
          <i className="bi bi-tree-fill text-success me-2"></i>
          Hệ Thống Quản Lý Tài Sản Doanh Nghiệp (PostgreSQL & Three.js)
        </span>
      </nav>

      <div className="container-fluid px-4">
        {currentView === '3d-tree' ? (
          <div className="row justify-content-center">
            <div className="col-lg-7">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white fw-bold py-3 text-success">
                  <i className="bi bi-box-seam me-2"></i> Mô Hình Cây Thông 3D (Phân tầng quản lý)
                </div>
                <div className="card-body p-0 bg-white rounded-bottom">
                  <ThreePineTree onSelectTier={handleSelectTier} />
                </div>
              </div>
            </div>
          </div>
        ) : currentView === 'schematic' ? (
          <div>
            <AssetSchematic3D
              selectedTier={selectedTier}
              assets={assets}
              onBack={() => setCurrentView('3d-tree')}
              onOpenInventory={() => setCurrentView('inventory')}
              onAssetsChanged={refreshAssets}
            />
          </div>
        ) : (
          <AssetInventoryModal
            selectedTier={selectedTier}
            assets={assets}
            onBack={() => setCurrentView('schematic')}
            onAddAsset={handleAddAsset}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAssets={handleDeleteAssets}
          />
        )}
      </div>
    </div>
  );
}

export default App;
