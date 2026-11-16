import React, { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TreeNode, Asset } from '../../types/asset.types';

// --- CẤP 0: GỐC TẦNG CÂY ---
const TierRootNode = ({ data }: { data: { label: string } }) => (
  <div className="px-4 py-3 shadow-lg rounded-3 bg-dark text-white fw-bold border border-success text-center" style={{ minWidth: 240 }}>
    <i className="bi bi-tree-fill text-success fs-5 me-2"></i>
    <span>{data.label}</span>
    <Handle type="source" position={Position.Bottom} style={{ background: '#3498db', width: 12, height: 12 }} />
  </div>
);

// --- CẤP 1: LINE SẢN XUẤT ---
const LineNode = ({ data }: { data: { label: string; count: number } }) => (
  <div
    className="px-4 py-2.5 shadow rounded-3 text-white fw-bold text-center"
    style={{ minWidth: 210, backgroundColor: '#2980b9', border: '2px solid #1f618d' }}
  >
    <Handle type="target" position={Position.Top} style={{ background: '#1f618d', width: 10, height: 10 }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#4a235a', width: 10, height: 10 }} />
    <div>
      <i className="bi bi-diagram-2-fill me-1"></i> {data.label}
    </div>
    <div style={{ fontSize: '11px', opacity: 0.95 }} className="fw-normal mt-1">
      Production Line • {data.count} thiết bị
    </div>
  </div>
);

// --- CẤP 2: PC TRẠM THIẾT BỊ (Hiển thị đầy đủ các trường thông tin mới) ---
const PcNode = ({ data }: { data: { asset: Asset; monitorsCount: number } }) => {
  const { asset, monitorsCount } = data;
  const isOffline = asset.status === 'offline';
  const isPrinter = asset.category.includes('Printer');

  return (
    <div
      className={`p-2.5 shadow-sm rounded-3 border text-start ${
        isOffline ? 'bg-danger bg-opacity-10 border-danger text-danger' : 'text-white'
      }`}
      style={{
        width: 270,
        backgroundColor: isOffline ? '#fff5f5' : isPrinter ? '#b45309' : '#4a235a',
        borderColor: isOffline ? '#f5c6cb' : isPrinter ? '#78350f' : '#273746',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: isOffline ? '#dc3545' : '#273746', width: 8, height: 8 }} />
      {monitorsCount > 0 && (
        <Handle type="source" position={Position.Bottom} style={{ background: isOffline ? '#dc3545' : '#2ecc71', width: 8, height: 8 }} />
      )}
      
      {/* Tiêu đề & Hostname */}
      <div className="d-flex align-items-center border-bottom pb-1 mb-1.5 border-opacity-25">
        <i className={`bi fs-5 me-2 ${isOffline ? 'bi-exclamation-triangle-fill text-danger' : isPrinter ? 'bi-printer-fill text-warning' : 'bi-pc-display text-info'}`}></i>
        <div className="text-truncate fw-bold" style={{ fontSize: '12px' }} title={asset.hostname}>{asset.hostname}</div>
      </div>

      {/* Thông tin chi tiết các trường doanh nghiệp và MAC Address */}
      <div style={{ fontSize: '9.5px', lineHeight: '1.4' }} className={isOffline ? 'text-dark' : 'text-light'}>
        <div><strong className="opacity-75">IT Code:</strong> <span className="font-monospace text-warning fw-bold">{asset.it_asset_code}</span></div>
        <div><strong className="opacity-75">Category:</strong> {asset.category}</div>
        <div><strong className="opacity-75">Serial:</strong> <span className="font-monospace">{asset.serial_number}</span></div>
        <div><strong className="opacity-75">MAC Address:</strong> <span className="font-monospace text-info">{asset.mac_address || 'N/A'}</span></div>
        <div><strong className="opacity-75">PO/Invoice:</strong> <span className="font-monospace">{asset.po_invoice}</span></div>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-2 pt-1 border-top border-opacity-25" style={{ fontSize: '9px' }}>
        <span className={`fw-bold ${isOffline ? 'text-danger' : 'text-light opacity-75'}`}>
          {isOffline ? '🔴 Offline' : '🟢 Online'}
        </span>
        {monitorsCount > 0 && (
          <span className="badge bg-dark text-light">
            <i className="bi bi-display me-1"></i> {monitorsCount} Mon
          </span>
        )}
      </div>
    </div>
  );
};

// --- CẤP 3: MONITOR ---
const MonitorNode = ({ data }: { data: { asset: Asset; monitorIndex: number } }) => {
  const asset = data.asset;
  const isOnline = asset.status === 'online';
  return (
    <div
      className={`p-2 shadow-sm rounded-3 border text-start ${
        isOnline ? 'bg-success text-white border-success' : 'bg-danger text-white border-danger'
      }`}
      style={{ width: 190 }}
    >
      <Handle type="target" position={Position.Top} style={{ background: isOnline ? '#2ecc71' : '#dc3545', width: 6, height: 6 }} />
      
      <div className="d-flex align-items-center border-bottom border-opacity-25 pb-1 mb-1">
        <i className={`bi me-1.5 ${isOnline ? 'bi-display-fill' : 'bi-display'}`} style={{ fontSize: '13px' }}></i>
        <div className="fw-bold" style={{ fontSize: '11px' }}>Màn hình {data.monitorIndex}</div>
      </div>

      <div style={{ fontSize: '8.5px', lineHeight: '1.3', opacity: 0.95 }}>
        <div><strong>IT Code:</strong> <span className="font-monospace">{asset.it_asset_code}-M{data.monitorIndex}</span></div>
        <div><strong>SN:</strong> <span className="font-monospace">{asset.serial_number}-M{data.monitorIndex}</span></div>
        <div><strong>PO:</strong> <span className="font-monospace">{asset.po_invoice}</span></div>
      </div>

      <div className="mt-1 pt-1 border-top border-opacity-25 text-end" style={{ fontSize: '8px', fontWeight: 'bold' }}>
        {isOnline ? 'Hoạt động tốt' : 'Mất tín hiệu'}
      </div>
    </div>
  );
};

const nodeTypes = {
  tierRootNode: TierRootNode,
  lineNode: LineNode,
  pcNode: PcNode,
  monitorNode: MonitorNode,
};

interface AssetSchematicReactFlowProps {
  selectedTier: TreeNode | null;
  assets: Asset[];
  onBack: () => void;
}

export const AssetSchematicReactFlow: React.FC<AssetSchematicReactFlowProps> = ({
  selectedTier,
  assets,
  onBack,
}) => {
  const { generatedNodes, generatedEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const lineMap = new Map<string, Asset[]>();
    assets.forEach((asset) => {
      const lineName = asset.production_line || 'Line Mặc Định';
      if (!lineMap.has(lineName)) lineMap.set(lineName, []);
      lineMap.get(lineName)!.push(asset);
    });

    nodes.push({
      id: 'tier-root',
      type: 'tierRootNode',
      position: { x: 800, y: 20 },
      data: { label: selectedTier?.name || 'Khu Vực Sản Xuất' },
    });

    let lineOffsetY = 160;

    Array.from(lineMap.entries()).forEach(([lineName, lineAssets], lineIdx) => {
      const lineId = `line-${lineIdx}`;
      const lineX = 800;

      nodes.push({
        id: lineId,
        type: 'lineNode',
        position: { x: lineX, y: lineOffsetY },
        data: { label: lineName, count: lineAssets.length },
      });

      edges.push({
        id: `e-root-${lineId}`,
        source: 'tier-root',
        target: lineId,
        animated: true,
        style: { stroke: '#2980b9', strokeWidth: 4 },
      });

      // Phân tách riêng PC và Máy in (Printer)
      const pcAssets = lineAssets.filter(a => !a.category.includes('Printer'));
      const printerAssets = lineAssets.filter(a => a.category.includes('Printer'));

      const totalItemsCount = pcAssets.length + printerAssets.length;
      const spacingX = 310;
      const totalLineWidth = totalItemsCount * spacingX;
      const startX = lineX - totalLineWidth / 2 + 155;

      let itemIdx = 0;

      // 1. Render các PC trạm và Monitor của chúng
      pcAssets.forEach((asset) => {
        const isOffline = asset.status === 'offline';
        const pcId = `pc-${asset.id}`;
        const pcX = startX + itemIdx * spacingX;
        const pcY = lineOffsetY + 160;
        itemIdx++;

        nodes.push({
          id: pcId,
          type: 'pcNode',
          position: { x: pcX, y: pcY },
          data: { asset: asset, monitorsCount: 2 },
        });

        edges.push({
          id: `e-${lineId}-${pcId}`,
          source: lineId,
          target: pcId,
          animated: !isOffline,
          style: isOffline
            ? { stroke: '#e74c3c', strokeWidth: 3, strokeDasharray: '6,6' }
            : { stroke: '#34495e', strokeWidth: 3 },
        });

        // Monitor gắn với PC
        for (let m = 1; m <= 2; m++) {
          const monId = `mon-${asset.id}-${m}`;
          const monX = pcX + (m === 1 ? -50 : 50);
          const monY = pcY + 180;

          nodes.push({
            id: monId,
            type: 'monitorNode',
            position: { x: monX, y: monY },
            data: { asset: asset, monitorIndex: m },
          });

          edges.push({
            id: `e-${pcId}-${monId}`,
            source: pcId,
            target: monId,
            style: isOffline
              ? { stroke: '#e74c3c', strokeWidth: 3, strokeDasharray: '6,6' }
              : { stroke: '#2ecc71', strokeWidth: 2.5 },
          });
        }
      });

      // 2. Render Máy in (Printer) độc lập trên Line (Không bị gắn vào màn hình)
      printerAssets.forEach((printer) => {
        const isOffline = printer.status === 'offline';
        const printerId = `printer-${printer.id}`;
        const printerX = startX + itemIdx * spacingX;
        const printerY = lineOffsetY + 160;
        itemIdx++;

        nodes.push({
          id: printerId,
          type: 'pcNode', // Hoặc tạo 1 node printer riêng nếu muốn
          position: { x: printerX, y: printerY },
          data: { asset: printer, monitorsCount: 0 },
        });

        edges.push({
          id: `e-${lineId}-${printerId}`,
          source: lineId,
          target: printerId,
          animated: !isOffline,
          style: isOffline
            ? { stroke: '#e74c3c', strokeWidth: 3, strokeDasharray: '6,6' }
            : { stroke: '#d35400', strokeWidth: 3 }, // Dây màu cam cho thiết bị ngoại vi/máy in
        });
      });

      lineOffsetY += 520;
    });

    return { generatedNodes: nodes, generatedEdges: edges };
  }, [selectedTier, assets]);

  const [nodes, setNodes, onNodesChange] = useNodesState(generatedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(generatedEdges);

  useEffect(() => {
    setNodes(generatedNodes);
    setEdges(generatedEdges);
  }, [generatedNodes, generatedEdges, setNodes, setEdges]);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
        <button className="btn btn-outline-dark btn-sm d-flex align-items-center gap-1" onClick={onBack}>
          <i className="bi bi-arrow-left"></i> Quay lại Cây 3D
        </button>
        <span className="fw-bold text-success">
          <i className="bi bi-diagram-3-fill me-2"></i> Sơ đồ hệ thống: {selectedTier?.name}
        </span>
        
        <div className="d-flex align-items-center flex-wrap gap-2 small bg-light px-3 py-2 rounded border">
          <span className="fw-bold text-secondary me-1">Chú thích:</span>
          <span className="badge" style={{ backgroundColor: '#2980b9' }}>Production Line</span>
          <span className="badge" style={{ backgroundColor: '#4a235a' }}>PC Trạm</span>
          <span className="badge bg-success">Online</span>
          <span className="badge bg-danger">Offline</span>
          <span className="text-muted">|</span>
          <span style={{ color: '#34495e', fontWeight: 'bold' }}>━━━ Dây liền (Ổn định)</span>
          <span className="text-danger"><strong>- - -</strong> Dây đứt nét (Offline)</span>
        </div>
      </div>
      <div className="card-body p-0" style={{ height: '760px', background: '#fcfcfc' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
        >
          <Controls />
          <MiniMap zoomable pannable />
          <Background gap={16} size={1} color="#e5e7eb" />
        </ReactFlow>
      </div>
    </div>
  );
};