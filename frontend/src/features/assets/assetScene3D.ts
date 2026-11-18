import * as THREE from 'three';
import type { Asset } from '../../types/asset.types';
import { SCENE, SIZE, type Kind, type TierPlan } from './schematic3dLayout';

/** Màu theo bản vẽ tay: Monitor xanh dương, PC nâu, Máy in cam, Line đen, dây nối xanh lá.
 *  Thiết bị offline đổi sang đỏ để nhìn là biết. */
export const COLORS = {
  monitor: 0x1e90ff,
  pc: 0xb5651d,
  printer: 0xff7f11,
  line: 0x111111,
  wire: 0x7bd911,
  offline: 0xe03131,
  frame: 0x2980b9,
  box: 0x495057,
};

const FILL_OPACITY = 0.38;
type Fills = THREE.Mesh[];

// ---------------------------------------------------------------- khối "kính màu"
/** 1 khối trong suốt có màu + viền đậm hơn cho rõ nét. */
function addBox(
  g: THREE.Group, fills: Fills,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  color: number, opacity = FILL_OPACITY,
): void {
  const geo = new THREE.BoxGeometry(w, h, d);
  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.25, metalness: 0, depthWrite: false }),
  );
  fill.position.set(x, y, z);
  fill.userData.baseOpacity = opacity;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.65) }),
  );
  edges.position.set(x, y, z);
  g.add(fill, edges);
  fills.push(fill);
}

/** Nút tròn nằm trên mặt trước (trục xi-lanh quay về +Z). */
function addRoundButton(g: THREE.Group, fills: Fills, r: number, x: number, y: number, z: number, color: number): void {
  const geo = new THREE.CylinderGeometry(r, r, 0.012, 20);
  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.9, roughness: 0.25, depthWrite: false }),
  );
  fill.rotation.x = Math.PI / 2;
  fill.position.set(x, y, z);
  fill.userData.baseOpacity = 0.9;
  g.add(fill);
  fills.push(fill);
}

// ---------------------------------------------------------------- hình dáng từng loại
/** Màn hình: dùng 1 kiểu cố định (đế + cổ + tấm màn hình). */
function buildMonitor(g: THREE.Group, f: Fills, c: number): void {
  const { w, h, d } = SIZE.monitor;
  const panelH = 0.46;
  const bottom = h - panelH;
  addBox(g, f, 0.3, 0.02, d, 0, 0.01, 0, c);
  addBox(g, f, 0.07, bottom - 0.02, 0.05, 0, 0.02 + (bottom - 0.02) / 2, -0.02, c);
  addBox(g, f, w, panelH, 0.04, 0, bottom + panelH / 2, 0, c);
}

/** "Monitor show up": tấm hiển thị dọc trên cột. */
function buildShow(g: THREE.Group, f: Fills, c: number): void {
  const { w, h } = SIZE.show;
  const panelH = 0.78;
  const bottom = h - panelH;
  addBox(g, f, 0.28, 0.02, 0.2, 0, 0.01, 0, c);
  addBox(g, f, 0.06, bottom - 0.02, 0.05, 0, 0.02 + (bottom - 0.02) / 2, 0, c);
  addBox(g, f, w, panelH, 0.04, 0, bottom + panelH / 2, 0, c);
}

/** PC vuông nhỏ kiểu HP ProDesk G3 (nằm ngang): khe ổ đĩa + nút nguồn. */
function buildPc(g: THREE.Group, f: Fills, c: number): void {
  const { w, h, d } = SIZE.pc;
  addBox(g, f, w, h, d, 0, h / 2, 0, c);
  const zf = d / 2 + 0.004;
  addBox(g, f, 0.22, 0.014, 0.008, -0.08, h * 0.66, zf, c, 0.9);
  addRoundButton(g, f, 0.022, 0.14, h * 0.3, zf, c);
}

/** PC to hình chữ nhật đứng (tower): khay ổ đĩa, nút nguồn, khe thoáng. */
function buildTower(g: THREE.Group, f: Fills, c: number): void {
  const { w, h, d } = SIZE.tower;
  addBox(g, f, w, h, d, 0, h / 2, 0, c);
  const zf = d / 2 + 0.004;
  addBox(g, f, 0.2, 0.035, 0.008, 0, h * 0.78, zf, c, 0.9);
  addRoundButton(g, f, 0.022, 0, h * 0.55, zf, c);
  [0.1, 0.14, 0.18].forEach((y) => addBox(g, f, 0.18, 0.008, 0.008, 0, y, zf, c, 0.9));
}

/** Máy in Zebra công nghiệp: thân + nắp mở cuộn nhãn, ô cửa sổ bên hông,
 *  màn hình LCD + phím và khe ra nhãn ở mặt trước. */
function buildZebra(g: THREE.Group, f: Fills, c: number): void {
  const { w, h, d } = SIZE.printer;
  const bodyH = 0.36;
  const coverH = h - bodyH;
  addBox(g, f, w, bodyH, d, 0, bodyH / 2, 0, c);
  addBox(g, f, w, coverH, d * 0.86, 0, bodyH + coverH / 2, -d * 0.07, c);
  addBox(g, f, 0.012, coverH * 0.6, d * 0.5, w / 2 + 0.006, bodyH + coverH * 0.5, -d * 0.07, c, 0.2);
  const zf = d / 2 + 0.008;
  addBox(g, f, 0.2, 0.1, 0.016, w * 0.18, bodyH * 0.7, zf, c, 0.85);
  [-1, 0, 1].forEach((i) => addBox(g, f, 0.035, 0.03, 0.016, w * 0.18 + i * 0.06, bodyH * 0.35, zf, c, 0.85));
  addBox(g, f, 0.28, 0.025, 0.02, -w * 0.17, bodyH * 0.45, zf, c, 0.9);
}

export function createModel(kind: Kind, color: number): { group: THREE.Group; fills: THREE.Mesh[] } {
  const group = new THREE.Group();
  const fills: THREE.Mesh[] = [];
  switch (kind) {
    case 'monitor': buildMonitor(group, fills, color); break;
    case 'show': buildShow(group, fills, color); break;
    case 'pc': buildPc(group, fills, color); break;
    case 'tower': buildTower(group, fills, color); break;
    case 'printer': buildZebra(group, fills, color); break;
  }
  return { group, fills };
}

/** Sáng lên khi rê chuột vào. */
export function setGlow(fills: THREE.Mesh[] | undefined, on: boolean): void {
  fills?.forEach((m) => {
    const base = m.userData.baseOpacity as number;
    (m.material as THREE.MeshStandardMaterial).opacity = on ? Math.min(1, base + 0.35) : base;
  });
}

// ---------------------------------------------------------------- dây, nhãn, bóng dưới sàn
/** Dây xanh lá nối màn hình với PC, võng nhẹ xuống ở giữa. */
export function createWire(from: THREE.Vector3, to: THREE.Vector3, color: number): THREE.Mesh {
  const mid = from.clone().lerp(to, 0.5);
  mid.y -= 0.14;
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 8, false), new THREE.MeshBasicMaterial({ color }));
}

/** Nhãn chữ luôn quay về phía camera. Chiều rộng thật = sprite.scale.x. */
export function createLabel(text: string, height: number, bg: string, fg = '#ffffff'): THREE.Sprite {
  const px = 48;
  const pad = 18;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${px}px sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = px + pad * 2;
  canvas.width = w; // đổi kích thước canvas sẽ reset font nên đặt lại bên dưới
  canvas.height = h;
  ctx.font = `bold ${px}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.fillText(text, pad, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 10;
  sprite.scale.set((height * w) / h, height, 1);
  return sprite;
}

function createFloorMarker(w: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.15, d * 1.15),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[]; isSprite?: boolean };
    if (m.geometry && !m.isSprite) m.geometry.dispose(); // Sprite dùng chung 1 geometry của three
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    mats.forEach((mat) => {
      (mat as THREE.SpriteMaterial).map?.dispose();
      mat.dispose();
    });
  });
}

// ---------------------------------------------------------------- dựng cả "hộp" của tầng
export interface SceneBuild {
  group: THREE.Group;
  pickables: THREE.Mesh[];
  fillsByAsset: Map<number, THREE.Mesh[]>;
  assetByMesh: Map<THREE.Object3D, Asset>;
  bounds: THREE.Box3;
}

const colorFor = (kind: Kind, offline: boolean): number =>
  offline ? COLORS.offline : kind === 'printer' ? COLORS.printer : kind === 'pc' || kind === 'tower' ? COLORS.pc : COLORS.monitor;

/**
 * Hộp kính chứa cả tầng → mỗi line là 1 khung bao quanh tài sản của nó (+ thanh line đen).
 * Line nằm đúng chỗ trên mặt bằng như bản vẽ (schematic3dLayout.LINE_LAYOUT).
 * Màn hình / PC lơ lửng trên không, máy in đặt dưới sàn, dây xanh lá nối màn hình với PC.
 * Thiết bị trong line xếp theo trục X, chiều sâu theo trục Z (phía trước = +Z, hướng về camera).
 */
export function buildScene(plan: TierPlan, tierName: string): SceneBuild {
  const { floatY, pad, frameHeight } = SCENE;
  const group = new THREE.Group();
  const pickables: THREE.Mesh[] = [];
  const fillsByAsset = new Map<number, THREE.Mesh[]>();
  const assetByMesh = new Map<THREE.Object3D, Asset>();

  const margin = 0.6; // đệm giữa các khung line và thành hộp
  const xMin = plan.xMin - margin;
  const xMax = plan.xMax + margin;
  const zMin = plan.zMin - margin;
  const zMax = plan.zMax + margin;
  const yMax = frameHeight + 0.5;

  // hộp chứa + sàn
  const boxGeo = new THREE.BoxGeometry(xMax - xMin, yMax, zMax - zMin);
  const center = new THREE.Vector3((xMin + xMax) / 2, yMax / 2, (zMin + zMax) / 2);
  const boxFill = new THREE.Mesh(
    boxGeo,
    new THREE.MeshBasicMaterial({ color: 0x74c0fc, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.BackSide }),
  );
  boxFill.position.copy(center);
  const boxEdges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color: COLORS.box }));
  boxEdges.position.copy(center);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(xMax - xMin, zMax - zMin),
    new THREE.MeshBasicMaterial({ color: 0xdee2e6, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0.001, center.z);
  group.add(boxFill, boxEdges, floor);

  const total = plan.lines.reduce((s, l) => s + l.items.length, 0);
  const tierLabel = createLabel(
    total > 0 ? `${tierName} • ${total} thiết bị` : `${tierName} • chưa có tài sản`,
    0.45,
    'rgba(33,37,41,0.92)',
  );
  tierLabel.position.set(xMin + tierLabel.scale.x / 2, yMax + 0.4, zMax);
  group.add(tierLabel);

  plan.lines.forEach((line) => {
    const z = line.z;
    const fw = line.length + pad * 2;
    const fd = line.zFront - line.zBack;
    const cx = line.x0 + line.length / 2;

    // khung bao quát line
    const frameGeo = new THREE.BoxGeometry(fw, frameHeight, fd);
    const framePos = new THREE.Vector3(cx, frameHeight / 2, z + (line.zFront + line.zBack) / 2);
    const frameFill = new THREE.Mesh(
      frameGeo,
      new THREE.MeshBasicMaterial({ color: COLORS.frame, transparent: true, opacity: 0.05, depthWrite: false }),
    );
    frameFill.position.copy(framePos);
    const frameEdges = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), new THREE.LineBasicMaterial({ color: COLORS.frame }));
    frameEdges.position.copy(framePos);

    // thanh line (đen) chạy dọc, sát sàn: nằm sau hoặc trước dãy thiết bị tùy bản vẽ
    const bar = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.08, 0.14), new THREE.MeshStandardMaterial({ color: COLORS.line }));
    bar.position.set(cx, 0.04, z + (line.bar === 'back' ? -0.55 : 0.55));

    const lineLabel = createLabel(`${line.name} • ${line.items.length} thiết bị`, 0.3, '#2980b9');
    lineLabel.position.set(line.x0 - pad + lineLabel.scale.x / 2, frameHeight + 0.22, z + line.zFront);
    group.add(frameFill, frameEdges, bar, lineLabel);

    const placed = new Map<number, (typeof line.items)[number]>();
    line.items.forEach((it) => {
      placed.set(it.asset.id, it);
      const offline = it.asset.status === 'offline';
      const floating = it.kind !== 'printer';
      const color = colorFor(it.kind, offline);
      const { group: model, fills } = createModel(it.kind, color);
      const wz = z + (it.dz ?? 0);
      model.position.set(line.x0 + it.x, floating ? floatY : 0, wz);
      group.add(model);
      fills.forEach((m) => {
        pickables.push(m);
        assetByMesh.set(m, it.asset);
      });
      fillsByAsset.set(it.asset.id, fills);
      if (floating) {
        const marker = createFloorMarker(SIZE[it.kind].w, SIZE[it.kind].d, color);
        marker.position.set(line.x0 + it.x, 0.003, wz);
        group.add(marker);
      }
    });

    // dây xanh lá: màn hình (kể cả monitor show up) ↔ PC
    line.wires.forEach((w) => {
      const m = placed.get(w.monitorId);
      const p = placed.get(w.pcId);
      if (!m || !p) return;
      const dir = m.x < p.x ? 1 : -1; // 1: màn hình nằm bên trái PC
      const from = new THREE.Vector3(line.x0 + m.x + (dir * SIZE[m.kind].w) / 2, floatY + 0.18, z);
      const to = new THREE.Vector3(line.x0 + p.x - (dir * SIZE[p.kind].w) / 2, floatY + SIZE[p.kind].h / 2, z);
      const ok = m.asset.status === 'online' && p.asset.status === 'online';
      group.add(createWire(from, to, ok ? COLORS.wire : COLORS.offline));
    });
  });

  const bounds = new THREE.Box3(new THREE.Vector3(xMin, 0, zMin), new THREE.Vector3(xMax, yMax + 0.8, zMax));
  return { group, pickables, fillsByAsset, assetByMesh, bounds };
}
