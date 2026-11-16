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
import {isMonitor, isPrinter} from './assetUtils';

// --- CẤP 0: GỐC TẦNG CÂY ---
const TierRootNode = ({ data }: { data: { label: string } }) => (
  <div className="px-4 py-3 shadow-lg rounded-3 bg-dark text-white fw-bold border border-success text-center" style={{ width: 240 }}>
    <i className="bi bi-tree-fill text-success fs-5 me-2"></i>
    <span>{data.label}</span>
    <Handle type="source" position={Position.Bottom} style={{ background: '#3498db', width: 12, height: 12 }} />
  </div>
);

// --- CẤP 1: LINE SẢN XUẤT ---
const LineNode = ({ data }: { data: { label: string; count: number } }) => (
  <div
    className="px-4 py-2.5 shadow rounded-3 text-white fw-bold text-center"
    style={{ width: 210, backgroundColor: '#2980b9', border: '2px solid #1f618d' }}
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

// --- CẤP 2: PC / MÁY IN ---
const PcNode = ({ data }: { data: { asset: Asset; monitorsCount: number } }) => {
  const { asset, monitorsCount } = data;
  const isOffline = asset.status === 'offline';
  const printer = isPrinter(asset);

  return (
    <div
      className={`p-2.5 shadow-sm rounded-3 border text-start ${
        isOffline ? 'bg-danger bg-opacity-10 border-danger text-danger' : 'text-white'
      }`}
      style={{
        width: 270,
        backgroundColor: isOffline ? '#fff5f5' : printer ? '#b45309' : '#4a235a',
        borderColor: isOffline ? '#f5c6cb' : printer ? '#78350f' : '#273746',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: isOffline ? '#dc3545' : '#273746', width: 8, height: 8 }} />
      {monitorsCount > 0 && (
        <Handle type="source" position={Position.Bottom} style={{ background: isOffline ? '#dc3545' : '#2ecc71', width: 8, height: 8 }} />
      )}

      <div className="d-flex align-items-center border-bottom pb-1 mb-1.5 border-opacity-25">
        <i className={`bi fs-5 me-2 ${isOffline ? 'bi-exclamation-triangle-fill text-danger' : printer ? 'bi-printer-fill text-warning' : 'bi-pc-display text-info'}`}></i>
        <div className="text-truncate fw-bold" style={{ fontSize: '12px' }} title={asset.hostname}>
          {asset.hostname || asset.it_asset_code}
        </div>
      </div>

      <div style={{ fontSize: '9.5px', lineHeight: '1.4' }} className={isOffline ? 'text-dark' : 'text-light'}>
        <div><strong className="opacity-75">IT Code:</strong> <span className="font-monospace text-warning fw-bold">{asset.it_asset_code}</span></div>
        <div><strong className="opacity-75">Người dùng:</strong> {asset.assigned_to || '—'}{asset.department ? ` (${asset.department})` : ''}</div>
        <div><strong className="opacity-75">Category:</strong> {asset.category || '—'}</div>
        <div><strong className="opacity-75">Serial:</strong> <span className="font-monospace">{asset.serial_number || '—'}</span></div>
        <div><strong className="opacity-75">MAC Address:</strong> <span className="font-monospace text-info">{asset.mac_address || 'N/A'}</span></div>
        <div><strong className="opacity-75">PO/Invoice:</strong> <span className="font-monospace">{asset.po_invoice || '—'}</span></div>
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

// --- CẤP 3: MONITOR (tài sản thật, gắn vào PC qua parent_asset_id) ---
const MonitorNode = ({ data }: { data: { asset: Asset; label: string } }) => {
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
        <div className="fw-bold text-truncate" style={{ fontSize: '11px' }} title={asset.product || data.label}>
          {data.label}{asset.product ? ` • ${asset.product}` : ''}
        </div>
      </div>

      <div style={{ fontSize: '8.5px', lineHeight: '1.3', opacity: 0.95 }}>
        <div><strong>IT Code:</strong> <span className="font-monospace">{asset.it_asset_code}</span></div>
        <div><strong>SN:</strong> <span className="font-monospace">{asset.serial_number || '—'}</span></div>
        <div><strong>PO:</strong> <span className="font-monospace">{asset.po_invoice || '—'}</span></div>
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

// Kích thước dùng để căn bố cục
const PC_W = 270;
const MON_W = 190;
const MON_GAP = 10;
const CENTER_X = 800;

type Item = { kind: 'pc' | 'printer' | 'monitor'; asset: Asset; monitors: Asset[]; slot: number };

interface AssetSchematicReactFlowProps {
  selectedTier: TreeNode | null;
  assets: Asset[];
  onBack: () => void;
  onOpenInventory: () => void;
}

export const AssetSchematicReactFlow: React.FC<AssetSchematicReactFlowProps> = ({
  selectedTier,
  assets,
  onBack,
  onOpenInventory,
}) => {
  const { generatedNodes, generatedEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Gom theo line
    const lineMap = new Map<string, Asset[]>();
    assets.forEach((asset) => {
      const lineName = asset.production_line || 'Line Mặc Định';
      if (!lineMap.has(lineName)) lineMap.set(lineName, []);
      lineMap.get(lineName)!.push(asset);
    });

    nodes.push({
      id: 'tier-root',
      type: 'tierRootNode',
      position: { x: CENTER_X - 120, y: 20 },
      data: { label: selectedTier?.name || 'Khu Vực Sản Xuất' },
    });

    let lineOffsetY = 160;

    Array.from(lineMap.entries()).forEach(([lineName, lineAssets], lineIdx) => {
      const lineId = `line-${lineIdx}`;
      const lineY = lineOffsetY;

      nodes.push({
        id: lineId,
        type: 'lineNode',
        position: { x: CENTER_X - 105, y: lineY },
        data: { label: lineName, count: lineAssets.length },
      });
      edges.push({
        id: `e-root-${lineId}`,
        source: 'tier-root',
        target: lineId,
        animated: true,
        style: { stroke: '#2980b9', strokeWidth: 4 },
      });

      // Phân loại thiết bị của line này bằng dữ liệu thật
      const monitors = lineAssets.filter(isMonitor);
      const others = lineAssets.filter((a) => !isMonitor(a));
      const pcs = others.filter((a) => !isPrinter(a));
      const printers = others.filter(isPrinter);

      const otherIds = new Set(others.map((a) => a.id));
      const monitorsByParent = new Map<number, Asset[]>();
      const orphanMonitors: Asset[] = [];
      monitors.forEach((m) => {
        if (m.parent_asset_id && otherIds.has(m.parent_asset_id)) {
          const list = monitorsByParent.get(m.parent_asset_id) ?? [];
          list.push(m);
          monitorsByParent.set(m.parent_asset_id, list);
        } else {
          orphanMonitors.push(m); // monitor chưa gắn PC: nối thẳng vào line
        }
      });

      const items: Item[] = [
        ...pcs.map((a): Item => {
          const mons = monitorsByParent.get(a.id) ?? [];
          return { kind: 'pc', asset: a, monitors: mons, slot: Math.max(310, mons.length * (MON_W + MON_GAP) + 20) };
        }),
        ...printers.map((a): Item => ({ kind: 'printer', asset: a, monitors: monitorsByParent.get(a.id) ?? [], slot: 310 })),
        ...orphanMonitors.map((a): Item => ({ kind: 'monitor', asset: a, monitors: [], slot: MON_W + 20 })),
      ];

      const totalWidth = items.reduce((sum, it) => sum + it.slot, 0);
      let cursor = CENTER_X - totalWidth / 2;
      const rowY = lineY + 160;
      const monY = rowY + 215;

      items.forEach((item) => {
        const slotStart = cursor;
        cursor += item.slot;
        const a = item.asset;
        const isOffline = a.status === 'offline';
        const lineStyle = isOffline
          ? { stroke: '#e74c3c', strokeWidth: 3, strokeDasharray: '6,6' }
          : { stroke: item.kind === 'pc' ? '#34495e' : '#d35400', strokeWidth: 3 };

        if (item.kind === 'monitor') {
          const id = `mon-${a.id}`;
          nodes.push({
            id,
            type: 'monitorNode',
            position: { x: slotStart + (item.slot - MON_W) / 2, y: rowY },
            data: { asset: a, label: 'Màn hình' },
          });
          edges.push({ id: `e-${lineId}-${id}`, source: lineId, target: id, animated: !isOffline, style: lineStyle });
          return;
        }

        const pcId = `${item.kind}-${a.id}`;
        nodes.push({
          id: pcId,
          type: 'pcNode',
          position: { x: slotStart + (item.slot - PC_W) / 2, y: rowY },
          data: { asset: a, monitorsCount: item.monitors.length },
        });
        edges.push({ id: `e-${lineId}-${pcId}`, source: lineId, target: pcId, animated: !isOffline, style: lineStyle });

        // Monitor thật của PC này, căn giữa phía dưới
        const n = item.monitors.length;
        const groupW = n * MON_W + (n - 1) * MON_GAP;
        const groupStart = slotStart + (item.slot - groupW) / 2;
        item.monitors.forEach((m, idx) => {
          const monId = `mon-${m.id}`;
          nodes.push({
            id: monId,
            type: 'monitorNode',
            position: { x: groupStart + idx * (MON_W + MON_GAP), y: monY },
            data: { asset: m, label: `Màn hình ${idx + 1}` },
          });
          edges.push({
            id: `e-${pcId}-${monId}`,
            source: pcId,
            target: monId,
            style:
              m.status === 'online'
                ? { stroke: '#2ecc71', strokeWidth: 2.5 }
                : { stroke: '#e74c3c', strokeWidth: 3, strokeDasharray: '6,6' },
          });
        });
      });

      const hasMonitorRow = items.some((it) => it.monitors.length > 0);
      lineOffsetY += hasMonitorRow ? 620 : 400;
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
        <button
          className="btn btn-primary btn-sm d-flex align-items-center gap-1 px-3 shadow-sm"
          onClick={onOpenInventory}
        >
          <i className="bi bi-list-check"></i> Mở Bảng Kiểm Kê Tài Sản
        </button>

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
