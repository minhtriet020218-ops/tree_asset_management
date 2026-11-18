import type { Asset } from '../../types/asset.types';
import { isMonitor, isPrinter, isShowMonitor, isTowerPc } from './assetUtils';

/** monitor: màn hình thường | show: "monitor show up" (tấm hiển thị dọc ở đầu line) | pc: PC vuông (kiểu HP G3)
 *  tower: PC to hình chữ nhật đứng | printer: máy in Zebra */
export type Kind = 'monitor' | 'show' | 'pc' | 'tower' | 'printer';

/** Kích thước (đơn vị scene) từng loại: dùng chung cho xếp vị trí lẫn vẽ hình.
 *  Gốc của mỗi hình = giữa đáy, mặt trước hướng +Z. Cố ý phóng to PC/máy in một chút cho dễ nhìn. */
export const SIZE: Record<Kind, { w: number; h: number; d: number }> = {
  monitor: { w: 0.8, h: 0.62, d: 0.2 },
  show: { w: 0.34, h: 0.95, d: 0.2 },
  pc: { w: 0.44, h: 0.14, d: 0.44 },
  tower: { w: 0.28, h: 0.64, d: 0.54 },
  printer: { w: 0.56, h: 0.62, d: 0.82 },
};

export const SCENE = {
  floatY: 1.15, // độ cao màn hình / PC "lơ lửng" so với sàn
  pad: 0.6, // đệm hai đầu line bên trong khung line
  frameDepth: 1.5,
  frameHeight: 2.6,
  lineGap: 0.7, // khoảng cách giữa 2 khung line
  itemGap: 0.32, // khe giữa 2 thiết bị trong 1 cụm (dây xanh đi qua khe này)
  groupGap: 0.9, // khe giữa 2 cụm PC
  endGap: 1.0, // khe trước cụm máy in ở cuối line
};

export interface Placed {
  asset: Asset;
  kind: Kind;
  x: number; // tâm theo trục line
}
export interface Wire {
  monitorId: number;
  pcId: number;
}
export interface LinePlan {
  name: string;
  items: Placed[];
  wires: Wire[];
  length: number;
}
export interface TierPlan {
  lines: LinePlan[];
  width: number;
}

const label = (a: Asset) => a.hostname || a.it_asset_code || String(a.id);
const byName = (a: Asset, b: Asset) => label(a).localeCompare(label(b), undefined, { numeric: true });

/**
 * Xếp 1 line từ trái sang phải, giống bản vẽ tay:
 *   [monitor show up] [màn hình – PC – màn hình] [màn hình – PC] ... [máy in]
 * PC có k màn hình: nửa trên (làm tròn lên) nằm bên trái PC, phần còn lại bên phải.
 * Màn hình không gắn PC nào đứng riêng; máy in luôn ở cuối line.
 */
export function buildLinePlan(name: string, lineAssets: Asset[]): LinePlan {
  const sorted = [...lineAssets].sort(byName);
  const monitors = sorted.filter(isMonitor);
  const showMons = monitors.filter(isShowMonitor);
  const plainMons = monitors.filter((m) => !isShowMonitor(m));
  const printers = sorted.filter((a) => !isMonitor(a) && isPrinter(a));
  const pcs = sorted.filter((a) => !isMonitor(a) && !isPrinter(a));

  const pcIds = new Set(pcs.map((p) => p.id));
  const monsByPc = new Map<number, Asset[]>();
  const orphans: Asset[] = [];
  for (const m of plainMons) {
    const pid = m.parent_asset_id;
    if (pid != null && pcIds.has(pid)) {
      const list = monsByPc.get(pid) ?? [];
      list.push(m);
      monsByPc.set(pid, list);
    } else {
      orphans.push(m);
    }
  }

  const items: Placed[] = [];
  const wires: Wire[] = [];
  let cursor = 0; // mép phải của thiết bị vừa đặt
  let gapBefore = 0; // khe cần chèn trước thiết bị kế tiếp

  const put = (kind: Kind, asset: Asset): void => {
    cursor += gapBefore;
    gapBefore = SCENE.itemGap;
    const w = SIZE[kind].w;
    items.push({ asset, kind, x: cursor + w / 2 });
    cursor += w;
  };
  const section = (gap: number): void => {
    if (items.length > 0) gapBefore = gap;
  };

  showMons.forEach((m) => put('show', m));
  section(SCENE.groupGap);

  for (const pc of pcs) {
    const mons = monsByPc.get(pc.id) ?? [];
    const leftN = Math.ceil(mons.length / 2);
    mons.slice(0, leftN).forEach((m) => {
      put('monitor', m);
      wires.push({ monitorId: m.id, pcId: pc.id });
    });
    put(isTowerPc(pc) ? 'tower' : 'pc', pc);
    mons.slice(leftN).forEach((m) => {
      put('monitor', m);
      wires.push({ monitorId: m.id, pcId: pc.id });
    });
    section(SCENE.groupGap);
  }

  orphans.forEach((m) => put('monitor', m));
  section(SCENE.endGap);
  printers.forEach((p) => put('printer', p));

  return { name, items, wires, length: items.length > 0 ? cursor : 0 };
}

export function buildTierPlan(assets: Asset[]): TierPlan {
  const groups = new Map<string, Asset[]>();
  for (const a of assets) {
    const key = a.production_line?.trim() || 'Line Mặc Định';
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }
  const lines = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([name, list]) => buildLinePlan(name, list));
  return { lines, width: Math.max(0, ...lines.map((l) => l.length)) };
}
