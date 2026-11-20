import type { Asset } from '../../types/asset.types';
import { isMonitor, isPrinter, isShowMonitor, isStock, isTowerPc } from './assetUtils';

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
  endGap: 1.0, // khe trước cụm máy in ở đầu/cuối line
  colGap: 2.0, // khe giữa 2 cột line trên mặt bằng
  sameRowGap: 0.8, // khe giữa 2 line đứng cạnh nhau cùng hàng
  frontPrinterZ: 0.85, // máy in đặt phía trước dãy thiết bị: lệch về phía trước bao nhiêu
  frontExtra: 0.66, // khung line dài thêm bấy nhiêu để chứa máy in phía trước
};

/** Vị trí & kiểu của từng line trên mặt bằng, đọc từ bản vẽ tay.
 *  Khóa = đúng chữ trong cột Production Line của tài sản. Đổi tên line thật thì sửa khóa ở đây. */
export interface LineSpec {
  col: number; // cột trên mặt bằng (0 = trái nhất)
  z: number; // chiều sâu: nhỏ = phía sau (đầu bản vẽ), lớn = phía trước. Đơn vị scene
  after?: string; // đứng ngay sau 1 line khác (cùng cột, cùng hàng)
  bar: 'back' | 'front'; // thanh line đen nằm sau hay trước dãy thiết bị
  printer: 'left' | 'right' | 'front-left'; // máy in: đầu line / cuối line / phía trước, dưới màn hình đầu tiên
  show: 'left' | 'right'; // monitor show up nằm bên trái hay phải PC mà nó nối dây
}

export const LINE_LAYOUT: Record<string, LineSpec> = {
  // cột trái (3 line trên xuống dưới)
  'Line 1': { col: 0, z: 3.6, bar: 'back', printer: 'front-left', show: 'right' },
  'Line 2': { col: 0, z: 7.4, bar: 'front', printer: 'right', show: 'left' },
  'Line 3': { col: 0, z: 11.1, bar: 'front', printer: 'right', show: 'left' },
  // cột giữa
  'Line 4': { col: 1, z: 5.1, bar: 'back', printer: 'right', show: 'left' },
  // cột phải: hàng trên có 2 line đứng cạnh nhau, rồi 2 line có monitor show up
  'Line 5': { col: 2, z: 1.8, bar: 'front', printer: 'right', show: 'left' },
  'Line 6': { col: 2, z: 1.8, after: 'Line 5', bar: 'front', printer: 'right', show: 'left' },
  'Line 7': { col: 2, z: 7.0, bar: 'back', printer: 'left', show: 'left' },
  'Line 8': { col: 2, z: 10.5, bar: 'front', printer: 'right', show: 'left' },
};

/** Line không có trong LINE_LAYOUT: xếp thành 1 cột riêng bên phải, chồng lần lượt theo chiều sâu. */
const AUTO_SPEC: Omit<LineSpec, 'col' | 'z'> = { bar: 'back', printer: 'right', show: 'left' };


export interface Placed {
  asset: Asset;
  kind: Kind;
  x: number; // tâm theo trục line (0 = đầu line)
  key: number; // khóa thứ tự trong line (line_order, hoặc thứ hạng theo tên nếu chưa có)
  dz?: number; // lệch ra phía trước so với dãy thiết bị (máy in đặt phía trước)
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
  bar: 'back' | 'front';
  nodeId: number | null; // node (tầng/khu vực) mà đa số thiết bị trong line đang thuộc về, dùng khi biên chế thêm thiết bị vào line
  x0: number; // vị trí thế giới của x = 0 của line
  z: number; // vị trí thế giới của dãy thiết bị
  zBack: number; // mép sau / mép trước của khung line (tương đối so với z)
  zFront: number;
}
export interface TierPlan {
  lines: LinePlan[];
  xMin: number; // phạm vi các khung line (chưa tính phần đệm của hộp)
  xMax: number;
  zMin: number;
  zMax: number;
}

const label = (a: Asset) => a.hostname || a.it_asset_code || String(a.id);
const byName = (a: Asset, b: Asset) => label(a).localeCompare(label(b), undefined, { numeric: true });

/** Khóa thứ tự trong line: line_order do IT kéo thả đặt; chưa có thì dùng thứ hạng theo tên (1, 2, 3...). */
function orderKeys(list: Asset[]): Map<number, number> {
  const keys = new Map<number, number>();
  [...list].sort(byName).forEach((a, i) => keys.set(a.id, a.line_order != null && Number.isFinite(Number(a.line_order)) ? Number(a.line_order) : i + 1));
  return keys;
}
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

function majorityNode(list: Asset[]): number | null {
  const count = new Map<number, number>();
  for (const a of list) if (a.node_id != null) count.set(a.node_id, (count.get(a.node_id) ?? 0) + 1);
  let best: number | null = null;
  let bestN = 0;
  for (const [id, n] of count) {
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}

/**
 * Xếp 1 line từ trái sang phải theo bản vẽ:
 *   [máy in?] [PC cùng các màn hình quanh nó] ... [máy in?]
 * - PC có k màn hình: nửa trên (làm tròn lên) nằm bên trái, phần còn lại bên phải → "màn hình – PC – màn hình".
 *   PC có 1 màn hình thì màn hình nằm bên trái PC.
 * - Monitor show up nối với PC nào thì đứng cạnh PC đó, phía spec.show quy định (trái / phải).
 * - Màn hình không gắn PC đứng riêng cuối dãy. Máy in theo spec.printer.
 * Chỉ tính toán vị trí trong line (x tính từ đầu line); x0, z do buildTierPlan gán.
 */
export function buildLinePlan(name: string, lineAssets: Asset[], spec: Omit<LineSpec, 'col' | 'z'> = AUTO_SPEC): LinePlan {
  const keys = orderKeys(lineAssets);
  const keyOf = (a: Asset) => keys.get(a.id) ?? 0;
  const sorted = [...lineAssets].sort((a, b) => keyOf(a) - keyOf(b) || byName(a, b));
  const monitors = sorted.filter(isMonitor);
  const printers = sorted.filter((a) => !isMonitor(a) && isPrinter(a));
  const pcs = sorted.filter((a) => !isMonitor(a) && !isPrinter(a));

  const pcIds = new Set(pcs.map((p) => p.id));
  const regularByPc = new Map<number, Asset[]>();
  const showByPc = new Map<number, Asset[]>();
  const looseMons: Asset[] = [];
  const looseShows: Asset[] = [];
  const push = (m: Map<number, Asset[]>, k: number, a: Asset) => m.set(k, [...(m.get(k) ?? []), a]);
  for (const m of monitors) {
    const pid = m.parent_asset_id;
    const show = isShowMonitor(m);
    if (pid != null && pcIds.has(pid)) push(show ? showByPc : regularByPc, pid, m);
    else (show ? looseShows : looseMons).push(m);
  }

  const items: Placed[] = [];
  const wires: Wire[] = [];
  let cursor = 0; // mép phải của thiết bị vừa đặt
  let gapBefore = 0; // khe cần chèn trước thiết bị kế tiếp

  const put = (kind: Kind, asset: Asset): void => {
    cursor += gapBefore;
    gapBefore = SCENE.itemGap;
    const w = SIZE[kind].w;
    items.push({ asset, kind, x: cursor + w / 2, key: keyOf(asset) });
    cursor += w;
  };
  const section = (gap: number): void => {
    if (items.length > 0) gapBefore = gap;
  };

  const frontPrinters = spec.printer === 'front-left';
  if (spec.printer === 'left') {
    printers.forEach((p) => put('printer', p));
    section(SCENE.endGap);
  }
  if (spec.show === 'left') {
    looseShows.forEach((m) => put('show', m));
    section(SCENE.groupGap);
  }

  for (const pc of pcs) {
    const regular = regularByPc.get(pc.id) ?? [];
    const shows = showByPc.get(pc.id) ?? [];
    const k = regular.length + shows.length;
    let ordered: Asset[];
    let leftN: number;
    if (shows.length === 0) {
      ordered = regular;
      leftN = Math.ceil(k / 2);
    } else if (spec.show === 'left') {
      ordered = [...shows, ...regular];
      leftN = Math.max(shows.length, Math.ceil(k / 2));
    } else {
      ordered = [...regular, ...shows];
      leftN = regular.length;
    }
    const put1 = (m: Asset) => {
      put(isShowMonitor(m) ? 'show' : 'monitor', m);
      wires.push({ monitorId: m.id, pcId: pc.id });
    };
    ordered.slice(0, leftN).forEach(put1);
    put(isTowerPc(pc) ? 'tower' : 'pc', pc);
    ordered.slice(leftN).forEach(put1);
    section(SCENE.groupGap);
  }

  looseMons.forEach((m) => put('monitor', m));
  if (spec.show === 'right' && looseShows.length > 0) {
    section(SCENE.groupGap);
    looseShows.forEach((m) => put('show', m));
  }
  if (spec.printer === 'right') {
    section(SCENE.endGap);
    printers.forEach((p) => put('printer', p));
  }

  // máy in phía trước: nằm dưới sàn, thẳng hàng với thiết bị đầu tiên của line
  if (frontPrinters && printers.length > 0) {
    let px = items.length > 0 ? items[0].x - SIZE[items[0].kind].w / 2 : 0;
    for (const p of printers) {
      const w = SIZE.printer.w;
      items.push({ asset: p, kind: 'printer', x: px + w / 2, key: keyOf(p), dz: SCENE.frontPrinterZ });
      px += w + SCENE.itemGap;
    }
    cursor = Math.max(cursor, px - SCENE.itemGap);
  }

  return {
    name,
    items,
    wires,
    length: items.length > 0 ? cursor : 0,
    bar: spec.bar,
    nodeId: majorityNode(lineAssets),
    x0: 0,
    z: 0,
    zBack: -SCENE.frameDepth / 2,
    zFront: SCENE.frameDepth / 2 + (frontPrinters && printers.length > 0 ? SCENE.frontExtra : 0),
  };
}

/** Gom tài sản theo line, xếp từng line vào vị trí trên mặt bằng (LINE_LAYOUT), tránh chồng khung. */
export function buildTierPlan(assets: Asset[], layout: Record<string, LineSpec> = LINE_LAYOUT): TierPlan {
  const groups = new Map<string, Asset[]>();
  // Thiết bị trong Kho không thuộc line nào: chỉ hiện ở thanh Kho bên phải, không vẽ trong khung line
  for (const a of assets.filter((x) => !isStock(x))) {
    const key = (a.production_line ?? '').trim();
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const names = [...groups.keys()].sort(natural);
  const known = names.filter((n) => layout[n]);
  const unknown = names.filter((n) => !layout[n]);

  const { pad } = SCENE;
  const plans = new Map<string, LinePlan>();
  const colOf = new Map<string, number>();
  const afterOf = new Map<string, string | undefined>();

  for (const n of known) {
    const spec = layout[n];
    const plan = buildLinePlan(n, groups.get(n)!, spec);
    plan.z = spec.z;
    plans.set(n, plan);
    colOf.set(n, spec.col);
    afterOf.set(n, spec.after);
  }

  // line chưa có trong bản vẽ: 1 cột riêng bên phải, chồng lần lượt theo chiều sâu
  const autoCol = known.length > 0 ? Math.max(...known.map((n) => layout[n].col)) + 1 : 0;
  let zCursor = 0;
  for (const n of unknown) {
    const plan = buildLinePlan(n, groups.get(n)!);
    plan.z = zCursor - plan.zBack;
    zCursor = plan.z + plan.zFront + SCENE.lineGap;
    plans.set(n, plan);
    colOf.set(n, autoCol);
  }

  // xếp theo cột, từ trái sang phải; độ rộng cột lấy từ độ dài line thật nên không bao giờ chồng nhau
  const placed = new Set<string>();
  const cols = [...new Set([...colOf.values()])].sort((a, b) => a - b);
  let colLeft = 0;
  for (const c of cols) {
    const inCol = [...plans.keys()].filter((n) => colOf.get(n) === c);
    const dependsOn = (n: string) => {
      const a = afterOf.get(n);
      return a !== undefined && inCol.includes(a) ? a : undefined;
    };
    inCol.filter((n) => !dependsOn(n)).forEach((n) => {
      plans.get(n)!.x0 = colLeft + pad;
      placed.add(n);
    });
    let rest = inCol.filter((n) => !placed.has(n));
    for (let guard = 0; rest.length > 0 && guard < inCol.length; guard++) {
      rest = rest.filter((n) => {
        const prevName = dependsOn(n)!;
        if (!placed.has(prevName)) return true;
        const prev = plans.get(prevName)!;
        plans.get(n)!.x0 = prev.x0 + prev.length + pad + SCENE.sameRowGap + pad;
        placed.add(n);
        return false;
      });
    }
    const right = Math.max(...inCol.map((n) => plans.get(n)!.x0 + plans.get(n)!.length + pad));
    colLeft = right + SCENE.colGap;
  }

  const lines = [...plans.values()];
  if (lines.length === 0) return { lines, xMin: 0, xMax: 4, zMin: -SCENE.frameDepth / 2, zMax: SCENE.frameDepth / 2 };
  return {
    lines,
    xMin: Math.min(...lines.map((l) => l.x0 - pad)),
    xMax: Math.max(...lines.map((l) => l.x0 + l.length + pad)),
    zMin: Math.min(...lines.map((l) => l.z + l.zBack)),
    zMax: Math.max(...lines.map((l) => l.z + l.zFront)),
  };
}

/** Nhóm thiết bị cùng loại cạnh tranh vị trí với nhau: PC xếp với PC, màn hình với màn hình, máy in với máy in. */
const classOf = (k: Kind): 'pc' | 'mon' | 'printer' => (k === 'printer' ? 'printer' : k === 'pc' || k === 'tower' ? 'pc' : 'mon');
const kindOfAsset = (a: Asset): Kind => (isMonitor(a) ? (isShowMonitor(a) ? 'show' : 'monitor') : isPrinter(a) ? 'printer' : isTowerPc(a) ? 'tower' : 'pc');

export interface InsertionPoint {
  order: number; // giá trị line_order để lưu cho thiết bị được thả
  markerX: number; // vị trí (tính từ đầu line) để vẽ vạch báo "sẽ đứng ở đây"
}

/**
 * Thả `dragged` tại vị trí xLocal (tính từ đầu line) thì đứng ở đâu trong line?
 * Đứng giữa 2 thiết bị cùng nhóm gần nhất theo trục X: order = trung bình khóa của 2 thiết bị đó.
 * Thiết bị đang kéo (nếu đã nằm trong line này) không tính, nên kéo trong cùng line chỉ là đổi chỗ.
 */
export function insertionPoint(plan: LinePlan, dragged: Asset, xLocal: number): InsertionPoint {
  const cls = classOf(kindOfAsset(dragged));
  const peers = plan.items.filter((it) => it.asset.id !== dragged.id && classOf(it.kind) === cls).sort((a, b) => a.x - b.x);
  const idx = peers.filter((it) => it.x < xLocal).length;
  const prev = peers[idx - 1];
  const next = peers[idx];
  const edge = (it: Placed, side: 1 | -1) => it.x + (side * SIZE[it.kind].w) / 2;
  if (prev && next) return { order: (prev.key + next.key) / 2, markerX: (edge(prev, 1) + edge(next, -1)) / 2 };
  if (prev) return { order: prev.key + 1, markerX: edge(prev, 1) + SCENE.itemGap / 2 };
  if (next) return { order: next.key - 1, markerX: edge(next, -1) - SCENE.itemGap / 2 };
  return { order: 1, markerX: plan.length / 2 };
}
