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
  <div className="px-4 py-2 shadow rounded bg-dark text-white fw-bold border border-secondary text-center" style={{ minWidth: 180 }}>
    <i className="bi bi-tree-fill text-success me-2"></i>
    {data.label}
    <Handle type="source" position={Position.Bottom} style={{ background: '#e67e22', width: 10, height: 10 }} />
  </div>
);

// --- CẤP 1: LINE SẢN XUẤT (Cành lớn màu cam) ---
const LineNode = ({ data }: { data: { label: string; count: number } }) => (
  <div
    className="px-4 py-2 shadow rounded text-white fw-bold text-center"
    style={{ minWidth: 160, backgroundColor: '#e67e22', border: '2px solid #d35400' }}
  >
    <Handle type="target" position={Position.Top} style={{ background: '#d35400' }} />
    <div>
      <i className="bi bi-diagram-2-fill me-1"></i> {data.label}
    </div>
    <div style={{ fontSize: '11px', opacity: 0.9 }}>Cành lớn • {data.count} thiết bị</div>
    <Handle type="source" position={Position.Bottom} style={{ background: '#854d0e', width: 9, height: 9 }} />
  </div>
);

// --- CẤP 2: PC THIẾT BỊ (Cành nhỏ màu nâu / gãy khi offline) ---
const PcNode = ({ data }: { data: { label: string; serial: string; mac: string; status: string } }) => {
  const isOffline = data.status === 'offline';
  return (
    <div
      className={`px-3 py-2 shadow-sm rounded text-center border ${
        isOffline ? 'bg-danger bg-opacity-10 border-danger text-danger' : 'text-white'
      }`}
      style={{
        minWidth: 150,
        backgroundColor: isOffline ? undefined : '#795548',
        borderColor: isOffline ? undefined : '#5d4037',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <i className={`bi fs-5 ${isOffline ? 'bi-exclamation-triangle-fill' : 'bi-pc-display'}`}></i>
      <div className="small fw-bold">{data.label}</div>
      <div style={{ fontSize: '10px', opacity: 0.85 }}>{data.serial}</div>
      <div style={{ fontSize: '10px' }} className={isOffline ? 'text-danger fw-bold mt-1' : 'text-warning mt-1'}>
        {isOffline ? '⚡ Cành gãy (Offline)' : '🌿 Cành nâu (Online)'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// --- CẤP 3: MONITOR (Lá xanh Online / Lá đỏ héo Offline) ---
const MonitorNode = ({ data }: { data: { label: string; status: string } }) => {
  const isOnline = data.status === 'online';
  return (
    <div
      className={`px-3 py-2 shadow-sm rounded-pill text-center border d-flex align-items-center gap-2 ${
        isOnline ? 'bg-success text-white border-success' : 'bg-danger text-white border-danger'
      }`}
      style={{ minWidth: 150 }}
    >
      <Handle type="target" position={Position.Top} />
      <i className={`bi fs-5 ${isOnline ? 'bi-leaf-fill' : 'bi-flower1'}`}></i>
      <div className="text-start">
        <div className="fw-bold" style={{ fontSize: '11px' }}>{data.label}</div>
        <div style={{ fontSize: '9px' }}>{isOnline ? 'Lá Xanh (Online)' : 'Lá Đỏ Héo (Offline)'}</div>
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
  // Tự động dựng cây từ dữ liệu assets gom theo line_name
  const { generatedNodes, generatedEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Gom nhóm tài sản theo Line sản xuất
    const lineMap = new Map<string, Asset[]>();
    assets.forEach((asset) => {
      const lineName = asset.line_name || 'Line Chưa Phân Loại';
      if (!lineMap.has(lineName)) lineMap.set(lineName, []);
      lineMap.get(lineName)!.push(asset);
    });

    const assetSpacingX = 210;
    const totalWidth = Math.max(assets.length * assetSpacingX, 400);
    const rootX = totalWidth / 2 - 90;

    // 1. Node Gốc (Tầng cây)
    nodes.push({
      id: 'tier-root',
      type: 'tierRootNode',
      position: { x: rootX, y: 20 },
      data: { label: selectedTier?.name || 'Khu Vực Sản Xuất' },
    });

    let currentX = 0;

    // 2. Duyệt từng Line -> PC -> Monitor
    Array.from(lineMap.entries()).forEach(([lineName, lineAssets], lineIdx) => {
      const lineId = `line-${lineIdx}`;
      const lineWidth = lineAssets.length * assetSpacingX;
      const lineCenterX = currentX + lineWidth / 2 - 80;

      // Node Line sản xuất (Cành lớn màu cam)
      nodes.push({
        id: lineId,
        type: 'lineNode',
        position: { x: lineCenterX, y: 130 },
        data: { label: lineName, count: lineAssets.length },
      });

      // Cành lớn màu cam nối từ Tầng -> Line
      edges.push({
        id: `e-root-${lineId}`,
        source: 'tier-root',
        target: lineId,
        animated: true,
        style: { stroke: '#e67e22', strokeWidth: 5 },
      });

      // Duyệt từng thiết bị trong Line
      lineAssets.forEach((asset, assetIdx) => {
        const isOffline = asset.status === 'offline';
        const itemX = currentX + assetIdx * assetSpacingX;
        const pcId = `pc-${asset.id}`;
        const monId = `mon-${asset.id}`;

        // Node PC (Cành nhỏ màu nâu / gãy)
        nodes.push({
          id: pcId,
          type: 'pcNode',
          position: { x: itemX, y: 260 },
          data: {
            label: asset.hostname,
            serial: asset.serial_number,
            mac: asset.mac_address,
            status: asset.status,
          },
        });

        // Đường nối Line -> PC (Cành nâu liền hoặc nét đứt đỏ nếu gãy)
        edges.push({
          id: `e-${lineId}-${pcId}`,
          source: lineId,
          target: pcId,
          animated: !isOffline,
          style: isOffline
            ? { stroke: '#c0392b', strokeWidth: 3, strokeDasharray: '6,6' }
            : { stroke: '#795548', strokeWidth: 3.5 },
        });

        // Node Monitor (Lá xanh / Lá đỏ héo)
        nodes.push({
          id: monId,
          type: 'monitorNode',
          position: { x: itemX, y: 400 },
          data: {
            label: `Monitor (${asset.hostname})`,
            status: asset.status,
          },
        });

        // Đường nối PC -> Monitor
        edges.push({
          id: `e-${pcId}-${monId}`,
          source: pcId,
          target: monId,
          style: {
            stroke: isOffline ? '#e74c3c' : '#2ecc71',
            strokeWidth: 2.5,
            strokeDasharray: isOffline ? '4,4' : undefined,
          },
        });
      });

      currentX += lineWidth + 60;
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
      <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
        <button className="btn btn-outline-dark btn-sm" onClick={onBack}>
          <i className="bi bi-arrow-left me-1"></i> Quay lại Cây 3D
        </button>
        <span className="fw-bold text-success">
          <i className="bi bi-diagram-3 me-2"></i> Sơ đồ sinh thái: {selectedTier?.name}
        </span>
        <div className="d-flex gap-2">
          <span className="badge" style={{ backgroundColor: '#e67e22' }}>Line (Cành cam)</span>
          <span className="badge" style={{ backgroundColor: '#795548' }}>PC (Cành nâu)</span>
          <span className="badge bg-success">Monitor Online</span>
          <span className="badge bg-danger">Offline / Gãy</span>
        </div>
      </div>
      <div className="card-body p-0" style={{ height: '580px', background: '#fcfcfc' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap zoomable pannable />
          <Background gap={16} size={1} color="#e5e7eb" />
        </ReactFlow>
      </div>
    </div>
  );
};