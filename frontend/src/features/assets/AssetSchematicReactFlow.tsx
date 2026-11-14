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
    style={{ minWidth: 190, backgroundColor: '#2980b9', border: '2px solid #1f618d' }}
  >
    <Handle type="target" position={Position.Top} style={{ background: '#1f618d', width: 10, height: 10 }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#4a235a', width: 10, height: 10 }} />
    <div>
      <i className="bi bi-diagram-2-fill me-1"></i> {data.label}
    </div>
    <div style={{ fontSize: '11px', opacity: 0.95 }} className="fw-normal mt-1">
      Dây chuyền • {data.count} PC trạm
    </div>
  </div>
);

// --- CẤP 2: PC TRẠM THIẾT BỊ ---
const PcNode = ({ data }: { data: { label: string; serial: string; mac: string; status: string; monitorsCount: number } }) => {
  const isOffline = data.status === 'offline';
  return (
    <div
      className={`p-2.5 shadow-sm rounded-3 border text-start ${
        isOffline ? 'bg-danger bg-opacity-10 border-danger text-danger' : 'text-white'
      }`}
      style={{
        width: 210,
        backgroundColor: isOffline ? '#fff5f5' : '#4a235a',
        borderColor: isOffline ? '#f5c6cb' : '#273746',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: isOffline ? '#dc3545' : '#273746', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: isOffline ? '#dc3545' : '#2ecc71', width: 8, height: 8 }} />
      
      <div className="d-flex align-items-center border-bottom pb-1 mb-1.5 border-opacity-25">
        <i className={`bi fs-5 me-2 ${isOffline ? 'bi-exclamation-triangle-fill text-danger' : 'bi-pc-display text-info'}`}></i>
        <div className="text-truncate fw-bold" style={{ fontSize: '12px' }} title={data.label}>{data.label}</div>
      </div>

      <div style={{ fontSize: '10px', lineHeight: '1.4' }} className={isOffline ? 'text-dark' : 'text-light'}>
        <div><strong className="opacity-75">Serial:</strong> <span className="font-monospace">{data.serial}</span></div>
        <div><strong className="opacity-75">MAC:</strong> <span className="font-monospace">{data.mac}</span></div>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-2 pt-1 border-top border-opacity-25" style={{ fontSize: '9px' }}>
        <span className={`fw-bold ${isOffline ? 'text-danger' : 'text-light opacity-75'}`}>
          {isOffline ? '🔴 Đang Offline' : '🟢 Đang Online'}
        </span>
        <span className="badge bg-dark text-light">
          <i className="bi bi-display me-1"></i> {data.monitorsCount} Mon
        </span>
      </div>
    </div>
  );
};

// --- CẤP 3: MONITOR ---
const MonitorNode = ({ data }: { data: { serial: string; mac: string; status: string; monitorIndex: number } }) => {
  const isOnline = data.status === 'online';
  return (
    <div
      className={`p-2 shadow-sm rounded-3 border text-start ${
        isOnline ? 'bg-success text-white border-success' : 'bg-danger text-white border-danger'
      }`}
      style={{ width: 170 }}
    >
      <Handle type="target" position={Position.Top} style={{ background: isOnline ? '#2ecc71' : '#dc3545', width: 6, height: 6 }} />
      
      <div className="d-flex align-items-center border-bottom border-opacity-25 pb-1 mb-1">
        <i className={`bi me-1.5 ${isOnline ? 'bi-display-fill' : 'bi-display'}`} style={{ fontSize: '13px' }}></i>
        <div className="fw-bold" style={{ fontSize: '11px' }}>Màn hình {data.monitorIndex}</div>
      </div>

      <div style={{ fontSize: '9px', lineHeight: '1.3', opacity: 0.95 }}>
        <div><strong>SN:</strong> <span className="font-monospace">{data.serial}</span></div>
        <div><strong>MAC:</strong> <span className="font-monospace">{data.mac}</span></div>
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
      const lineName = asset.line_name || 'Line Mặc Định';
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

      const pcSpacingX = 290;
      const totalLineWidth = lineAssets.length * pcSpacingX;
      const startX = lineX - totalLineWidth / 2 + 145;

      lineAssets.forEach((asset, pcIdx) => {
        const isOffline = asset.status === 'offline';
        const pcId = `pc-${asset.id}`;
        const pcX = startX + pcIdx * pcSpacingX;
        const pcY = lineOffsetY + 150;

        const monitorsCount = (pcIdx % 2 === 0) ? 2 : 1;

        nodes.push({
          id: pcId,
          type: 'pcNode',
          position: { x: pcX, y: pcY },
          data: {
            label: asset.hostname,
            serial: asset.serial_number,
            mac: asset.mac_address,
            status: asset.status,
            monitorsCount: monitorsCount,
          },
        });

        // 🛠 ĐÃ SỬA: Nếu thiết bị Offline thì dây nối từ Line xuống PC chuyển sang ĐỎ ĐỨT NÉT
        edges.push({
          id: `e-${lineId}-${pcId}`,
          source: lineId,
          target: pcId,
          animated: !isOffline,
          style: isOffline
            ? { stroke: '#e74c3c', strokeWidth: 2.5, strokeDasharray: '4,4' }
            : { stroke: '#34495e', strokeWidth: 3 },
        });

        const monitorSpacingX = 180;
        const startMonitorX = pcX + 15 - ((monitorsCount - 1) * monitorSpacingX) / 2;

        for (let m = 1; m <= monitorsCount; m++) {
          const monId = `mon-${asset.id}-${m}`;
          const monX = startMonitorX + (m - 1) * monitorSpacingX - 75;
          const monY = pcY + 160;

          const monSerial = `${asset.serial_number}-M${m}`;
          const monMac = asset.mac_address.replace(/:([0-9a-fA-F]{2})$/, (match, p1) => `:${(parseInt(p1, 16) + m).toString(16).padStart(2, '0')}`);

          nodes.push({
            id: monId,
            type: 'monitorNode',
            position: { x: monX, y: monY },
            data: {
              serial: monSerial,
              mac: monMac,
              status: asset.status,
              monitorIndex: m,
            },
          });

          // 🛠 ĐÃ SỬA: Nếu thiết bị Offline thì dây nối từ PC sang Monitor cũng chuyển sang ĐỎ ĐỨT NÉT
          edges.push({
            id: `e-${pcId}-${monId}`,
            source: pcId,
            target: monId,
            style: isOffline
              ? { stroke: '#e74c3c', strokeWidth: 2.5, strokeDasharray: '4,4' }
              : { stroke: '#2ecc71', strokeWidth: 2.5 },
          });
        }
      });

      lineOffsetY += 460;
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
          <span className="badge" style={{ backgroundColor: '#2980b9' }}>Line</span>
          <span className="badge" style={{ backgroundColor: '#4a235a' }}>PC Trạm</span>
          <span className="badge bg-success">Online</span>
          <span className="badge bg-danger">Offline</span>
          <span className="text-muted">|</span>
          <span style={{ color: '#34495e', fontWeight: 'bold' }}>--- Dây Line ➔ PC (Ổn định)</span>
          <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>━━━ Dây PC ➔ Monitor (Ổn định)</span>
          <span className="text-danger"><strong>- - -</strong> Dây đứt nét (Mất kết nối / Offline)</span>
        </div>
      </div>
      <div className="card-body p-0" style={{ height: '720px', background: '#fcfcfc' }}>
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