import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Asset, TreeNode } from '../../types/asset.types';
import { isMonitor, isMuted, isPrinter } from './assetUtils';

type Kind = 'pc' | 'printer' | 'monitor';
type SortKey = 'default' | 'mac' | 'hostname' | 'serial';

interface Props {
  selectedTier: TreeNode | null;
  assets: Asset[];
  onBack: () => void;
  onOpenInventory: () => void;
}

interface Block {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  label: THREE.Sprite;
  asset: Asset;
}

interface SceneBits {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
}

interface Tip {
  x: number;
  y: number;
  asset: Asset;
}

interface LabelRow {
  text: string;
  font: string;
  color: string;
}

// ---------- Kích thước và màu (đơn vị scene) ----------
const SLAB_H = 0.12; // độ dày tấm nền của line
const LINE_GAP = 6.8; // khoảng cách giữa các line (trục Z)
const LINE_DEPTH = 4.4; // chiều sâu tấm nền
const PC_SLOT = 3.0; // bề rộng mỗi vị trí PC / máy in
const MON_STEP = 1.5; // bề rộng mỗi màn hình
const MON_SLOT = 1.9; // bề rộng vị trí màn hình lẻ (chưa gắn PC)

const DIMS: Record<Kind, { w: number; h: number; d: number; y: number }> = {
  pc: { w: 1.0, h: 1.6, d: 1.1, y: SLAB_H },
  printer: { w: 1.6, h: 0.85, d: 1.2, y: SLAB_H },
  monitor: { w: 1.3, h: 0.78, d: 0.1, y: SLAB_H + 0.54 },
};
const KIND_COLOR: Record<Kind, number> = { pc: 0x6f42c1, printer: 0xd9480f, monitor: 0x1c7ed6 };
const OFFLINE_COLOR = 0xe03131;
const MUTED_COLOR = 0xf59f00;

const kindOf = (a: Asset): Kind => (isMonitor(a) ? 'monitor' : isPrinter(a) ? 'printer' : 'pc');

function colorOf(a: Asset, kind: Kind): number {
  if (a.status === 'offline') return isMuted(a) ? MUTED_COLOR : OFFLINE_COLOR;
  return KIND_COLOR[kind];
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

// ---------- Sắp xếp và tìm kiếm theo MAC / hostname / serial ----------
const normMac = (s: string) => s.replace(/[:.\-\s]/g, '').toLowerCase();

function sortValue(a: Asset, key: SortKey): string {
  if (key === 'mac') return normMac(a.mac_address || '');
  if (key === 'hostname') return (a.hostname || a.it_asset_code || '').toLowerCase();
  if (key === 'serial') return (a.serial_number || '').toLowerCase();
  return '';
}

function sortDevices(list: Asset[], key: SortKey): Asset[] {
  if (key === 'default') {
    return [...list].sort((x, y) => Number(isPrinter(x)) - Number(isPrinter(y)) || x.id - y.id);
  }
  return [...list].sort((x, y) => {
    const a = sortValue(x, key);
    const b = sortValue(y, key);
    if (!a && b) return 1; // thiếu giá trị thì xếp cuối
    if (a && !b) return -1;
    return a.localeCompare(b, 'en', { numeric: true }) || x.id - y.id;
  });
}

function matchesQuery(a: Asset, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const tm = normMac(t);
  if ([a.hostname, a.serial_number, a.it_asset_code].some((v) => (v || '').toLowerCase().includes(t))) return true;
  return tm.length > 0 && normMac(a.mac_address || '').includes(tm);
}

// ---------- Nhãn chữ (sprite) ----------
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function makeLabel(rows: LabelRow[], w: number, h: number, accent: string, worldW: number, dot?: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 6, 16);
    ctx.fill();
    ctx.stroke();
    if (dot) {
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(w - 26, 26, 11, 0, Math.PI * 2);
      ctx.fill();
    }
    const rowH = (h - 16) / rows.length;
    ctx.textBaseline = 'middle';
    rows.forEach((r, i) => {
      ctx.font = r.font;
      ctx.fillStyle = r.color;
      ctx.fillText(ellipsize(ctx, r.text, w - 36 - (i === 0 && dot ? 30 : 0)), 18, 8 + rowH * (i + 0.5));
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(worldW, (worldW * h) / w, 1);
  sprite.renderOrder = 10;
  return sprite;
}

const MONO = 'ui-monospace, Consolas, monospace';

const deviceLabel = (a: Asset, kind: Kind): THREE.Sprite => {
  const dot = a.status === 'offline' ? (isMuted(a) ? hex(MUTED_COLOR) : hex(OFFLINE_COLOR)) : '#2f9e44';
  if (kind === 'monitor') {
    return makeLabel(
      [
        { text: a.product || 'Monitor', font: '700 30px system-ui, sans-serif', color: '#212529' },
        { text: `SN ${a.serial_number || 'N/A'}`, font: `600 26px ${MONO}`, color: '#495057' },
      ],
      330, 130, hex(colorOf(a, kind)), 1.45, dot,
    );
  }
  return makeLabel(
    [
      { text: a.hostname || a.it_asset_code, font: '700 36px system-ui, sans-serif', color: '#212529' },
      { text: `MAC  ${a.mac_address || 'N/A'}`, font: `600 27px ${MONO}`, color: '#0b7285' },
      { text: `SN   ${a.serial_number || 'N/A'}`, font: `600 27px ${MONO}`, color: '#495057' },
    ],
    560, 200, hex(colorOf(a, kind)), 2.8, dot,
  );
};

// ---------- Giải phóng bộ nhớ ----------
function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Sprite) {
      obj.material.map?.dispose();
      obj.material.dispose();
      return;
    }
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}

export const AssetSchematic3D: FC<Props> = ({ selectedTier, assets, onBack, onOpenInventory }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const bitsRef = useRef<SceneBits | null>(null);
  const blocksRef = useRef<Map<number, Block>>(new Map());
  const fitRef = useRef<(() => void) | null>(null);
  const topRef = useRef<(() => void) | null>(null);
  const flyToRef = useRef<((pos: THREE.Vector3, target: THREE.Vector3) => void) | null>(null);
  const fittedKeyRef = useRef<string | null>(null);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showLabels, setShowLabels] = useState(true);
  const [mouseMode, setMouseMode] = useState<'rotate' | 'pan'>('rotate');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<Tip | null>(null);

  const tierKey = String(selectedTier?.id ?? 'none');

  const matchedIds = useMemo(() => {
    const set = new Set<number>();
    assets.forEach((a) => {
      if (matchesQuery(a, query)) set.add(a.id);
    });
    return set;
  }, [assets, query]);

  const selected = selectedId === null ? null : (assets.find((a) => a.id === selectedId) ?? null);
  const parentOfSelected = selected?.parent_asset_id ? assets.find((a) => a.id === selected.parent_asset_id) : undefined;
  const devices = assets.filter((a) => !isMonitor(a));
  const offlineCount = devices.filter((a) => a.status === 'offline').length;

  // ---- A) Dựng khung 3D một lần: camera, ánh sáng, điều khiển chuột ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);

    const camera = new THREE.PerspectiveCamera(50, Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1), 0.1, 2000);
    camera.position.set(0, 9, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(Math.max(mount.clientWidth, 1), Math.max(mount.clientHeight, 1));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.5;
    controls.maxDistance = 400;
    controls.maxPolarAngle = Math.PI; // xoay tự do, không bị khóa góc nhìn
    controls.zoomToCursor = true; // cuộn chuột = phóng về phía con trỏ
    controls.screenSpacePanning = true; // dịch camera theo mặt phẳng màn hình
    controls.panSpeed = 1.3;
    controls.zoomSpeed = 1.3;

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(8, 20, 12);
    scene.add(sun);

    const grid = new THREE.GridHelper(200, 100, 0xced4da, 0xe9ecef);
    scene.add(grid);

    bitsRef.current = { scene, camera, controls };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // --- Di chuyển tự do: WASD / mũi tên + Q,E; bay camera tới vị trí mới ---
    const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE']);
    const keys = new Set<string>();
    let fast = false;
    let hoverCanvas = false;

    type Fly = { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; start: number };
    let fly: Fly | null = null;
    flyToRef.current = (pos, target) => {
      fly = {
        fromPos: camera.position.clone(),
        toPos: pos.clone(),
        fromTarget: controls.target.clone(),
        toTarget: target.clone(),
        start: performance.now(),
      };
    };

    const pick = (e: MouseEvent): { id: number | null; rect: DOMRect } => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(blocksRef.current.values())
        .filter((b) => b.mesh.visible)
        .map((b) => b.mesh);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return { id: hit ? (hit.object.userData.assetId as number) : null, rect };
    };

    const onMove = (e: MouseEvent) => {
      hoverCanvas = true;
      const { id, rect } = pick(e);
      const block = id === null ? undefined : blocksRef.current.get(id);
      renderer.domElement.style.cursor = block ? 'pointer' : 'default';
      setHoveredId(id);
      setTooltip(block ? { x: e.clientX - rect.left + 16, y: e.clientY - rect.top - 56, asset: block.asset } : null);
    };
    const onLeave = () => {
      hoverCanvas = false;
      keys.clear();
      setHoveredId(null);
      setTooltip(null);
    };

    // Chỉ coi là "click" khi chuột không bị kéo (kéo = xoay camera)
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      fly = null; // người dùng tự điều khiển thì dừng hiệu ứng bay
    };
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      setSelectedId(pick(e).id);
    };

    const el = renderer.domElement;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('click', onClick);

    // Double-click vào khối: camera bay tới gần thiết bị đó
    const onDbl = (e: MouseEvent) => {
      const { id } = pick(e);
      const b = id === null ? undefined : blocksRef.current.get(id);
      if (!b || !flyToRef.current) return;
      const p = b.mesh.position;
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(Math.min(Math.max(offset.length(), 5), 9));
      flyToRef.current(p.clone().add(offset), p.clone());
    };
    el.addEventListener('dblclick', onDbl);

    const onKeyDown = (e: KeyboardEvent) => {
      fast = e.shiftKey;
      if (!hoverCanvas || !MOVE_KEYS.has(e.code)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      keys.add(e.code);
      fly = null;
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      fast = e.shiftKey;
      keys.delete(e.code);
    };
    const onBlur = () => keys.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let frameId = 0;
    let last = performance.now();
    const MOVE = new THREE.Vector3();
    const FWD = new THREE.Vector3();
    const RIGHT = new THREE.Vector3();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (fly) {
        const t = Math.min((now - fly.start) / 600, 1);
        const k = 1 - Math.pow(1 - t, 3); // chậm dần khi tới nơi
        camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
        controls.target.lerpVectors(fly.fromTarget, fly.toTarget, k);
        if (t >= 1) fly = null;
      } else if (keys.size > 0) {
        const dist = Math.max(camera.position.distanceTo(controls.target), 4);
        const speed = dist * (fast ? 2.4 : 0.8) * dt;
        camera.getWorldDirection(FWD);
        FWD.y = 0;
        if (FWD.lengthSq() < 1e-4) {
          FWD.set(0, 1, 0).applyQuaternion(camera.quaternion); // đang nhìn thẳng xuống
          FWD.y = 0;
        }
        FWD.normalize();
        RIGHT.crossVectors(FWD, camera.up).normalize();
        MOVE.set(0, 0, 0);
        if (keys.has('KeyW') || keys.has('ArrowUp')) MOVE.add(FWD);
        if (keys.has('KeyS') || keys.has('ArrowDown')) MOVE.sub(FWD);
        if (keys.has('KeyD') || keys.has('ArrowRight')) MOVE.add(RIGHT);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) MOVE.sub(RIGHT);
        if (keys.has('KeyE')) MOVE.y += 1;
        if (keys.has('KeyQ')) MOVE.y -= 1;
        if (MOVE.lengthSq() > 0) {
          MOVE.normalize().multiplyScalar(speed);
          camera.position.add(MOVE);
          controls.target.add(MOVE);
        }
      }

      controls.update();
      if (camera.position.y < 0.2) camera.position.y = 0.2; // không chui xuống dưới sàn
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(frameId);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('click', onClick);
      el.removeEventListener('dblclick', onDbl);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      flyToRef.current = null;
      controls.dispose();
      disposeTree(grid);
      renderer.dispose();
      if (mount.contains(el)) mount.removeChild(el);
      bitsRef.current = null;
      fittedKeyRef.current = null;
    };
  }, []);

  // ---- Chế độ chuột: Xoay (trái = xoay, phải = dịch) hoặc Di chuyển (trái = dịch, phải = xoay) ----
  useEffect(() => {
    const c = bitsRef.current?.controls;
    if (!c) return;
    const pan = mouseMode === 'pan';
    c.mouseButtons.LEFT = pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    c.mouseButtons.RIGHT = pan ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    c.touches.ONE = pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  }, [mouseMode]);

  // ---- B) Dựng các khối theo dữ liệu thật (dựng lại khi dữ liệu / cách sắp xếp đổi) ----
  useEffect(() => {
    const bits = bitsRef.current;
    if (!bits) return;

    const group = new THREE.Group();
    const blocks = new Map<number, Block>();

    const addBlock = (a: Asset, kind: Kind, x: number, y0: number, z: number): void => {
      const d = DIMS[kind];
      const geo = new THREE.BoxGeometry(d.w, d.h, d.d);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorOf(a, kind), roughness: 0.45, metalness: 0.1 }));
      mesh.position.set(x, y0 + d.h / 2, z);
      mesh.userData = { assetId: a.id };
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x1b1b1b, transparent: true, opacity: 0.35 })));
      if (kind === 'monitor') {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.54, 0.14), new THREE.MeshStandardMaterial({ color: 0x495057 }));
        stand.position.set(0, -0.62, 0);
        mesh.add(stand);
      }
      group.add(mesh);

      const label = deviceLabel(a, kind);
      label.position.set(x, kind === 'monitor' ? 2.1 : 3.0, z);
      group.add(label);

      blocks.set(a.id, { mesh, label, asset: a });
    };

    // Gom theo line
    const lineMap = new Map<string, Asset[]>();
    assets.forEach((a) => {
      const name = a.production_line || 'Line Mặc Định';
      const list = lineMap.get(name) ?? [];
      list.push(a);
      lineMap.set(name, list);
    });
    const lines = Array.from(lineMap.entries()).sort(([x], [y]) => x.localeCompare(y, 'vi', { numeric: true }));

    lines.forEach(([lineName, lineAssets], lineIdx) => {
      const z = (lineIdx - (lines.length - 1) / 2) * LINE_GAP;

      const monitors = lineAssets.filter(isMonitor);
      const others = sortDevices(lineAssets.filter((a) => !isMonitor(a)), sortKey);
      const otherIds = new Set(others.map((a) => a.id));
      const monByParent = new Map<number, Asset[]>();
      const orphans: Asset[] = [];
      monitors.forEach((m) => {
        if (m.parent_asset_id && otherIds.has(m.parent_asset_id)) {
          const list = monByParent.get(m.parent_asset_id) ?? [];
          list.push(m);
          monByParent.set(m.parent_asset_id, list);
        } else orphans.push(m);
      });

      type Item = { asset: Asset; mons: Asset[]; slot: number };
      const items: Item[] = [
        ...others.map((a): Item => {
          const mons = monByParent.get(a.id) ?? [];
          return { asset: a, mons, slot: Math.max(PC_SLOT, mons.length * MON_STEP + 0.4) };
        }),
        ...orphans.map((a): Item => ({ asset: a, mons: [], slot: MON_SLOT })),
      ];
      const width = items.reduce((s, it) => s + it.slot, 0) + 1;

      // Tấm nền của line
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(width + 1, SLAB_H, LINE_DEPTH),
        new THREE.MeshStandardMaterial({ color: 0xe7f5ff, roughness: 0.9 }),
      );
      slab.position.set(0, SLAB_H / 2, z);
      group.add(slab);

      const off = others.filter((a) => a.status === 'offline').length;
      const lineLabel = makeLabel(
        [
          { text: lineName, font: '700 42px system-ui, sans-serif', color: '#1864ab' },
          { text: `${others.length} thiết bị • ${off} offline`, font: '600 26px system-ui, sans-serif', color: off > 0 ? '#c92a2a' : '#2b8a3e' },
        ],
        440, 130, '#1c7ed6', 2.4,
      );
      lineLabel.position.set(-(width + 1) / 2 - 1.5, 1.0, z);
      group.add(lineLabel);

      let cursor = -width / 2 + 0.5;
      items.forEach((it) => {
        const cx = cursor + it.slot / 2;
        cursor += it.slot;
        const kind = kindOf(it.asset);
        if (kind === 'monitor') {
          addBlock(it.asset, 'monitor', cx, DIMS.monitor.y, z);
          return;
        }
        addBlock(it.asset, kind, cx, DIMS[kind].y, z + 0.6);
        const n = it.mons.length;
        it.mons.forEach((m, i) => {
          const mx = cx + (i - (n - 1) / 2) * MON_STEP;
          addBlock(m, 'monitor', mx, DIMS.monitor.y, z - 0.9);
        });
      });
    });

    bits.scene.add(group);
    blocksRef.current = blocks;

    const frame = (top: boolean): { pos: THREE.Vector3; target: THREE.Vector3 } | null => {
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      if (box.isEmpty()) return null;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const dist = Math.max(size.x * 0.75, size.z * 1.5, 12);
      const target = new THREE.Vector3(center.x, 0.8, center.z);
      const pos = top
        ? new THREE.Vector3(center.x, dist * 1.25, center.z + 0.01)
        : new THREE.Vector3(center.x, dist * 0.65, center.z + dist);
      return { pos, target };
    };
    const go = (top: boolean) => {
      const f = frame(top);
      if (f) flyToRef.current?.(f.pos, f.target);
    };
    fitRef.current = () => go(false);
    topRef.current = () => go(true);
    if (fittedKeyRef.current !== tierKey && blocks.size > 0) {
      const f = frame(false);
      if (f) {
        bits.camera.position.copy(f.pos);
        bits.controls.target.copy(f.target);
        bits.controls.update();
      }
      fittedKeyRef.current = tierKey;
    }

    return () => {
      bits.scene.remove(group);
      disposeTree(group);
      blocksRef.current = new Map();
    };
  }, [assets, sortKey, tierKey]);

  // ---- C) Tô màu: tìm kiếm, rê chuột, chọn, bật/tắt nhãn (không dựng lại scene) ----
  useEffect(() => {
    const dim = query.trim().length > 0;
    blocksRef.current.forEach((b, id) => {
      const matched = !dim || matchedIds.has(id);
      const isSel = id === selectedId;
      const isHover = id === hoveredId;
      const mat = b.mesh.material;
      if (mat.transparent !== !matched) {
        mat.transparent = !matched;
        mat.needsUpdate = true;
      }
      mat.opacity = matched ? 1 : 0.18;
      if (isSel) mat.emissive.setHex(0x1971c2);
      else if (isHover) mat.emissive.setHex(0xff922b);
      else if (dim && matched) mat.emissive.setHex(0xffd43b);
      else mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = isSel ? 0.75 : isHover ? 0.5 : dim && matched ? 0.55 : 0;
      b.mesh.scale.setScalar(isSel ? 1.08 : 1);
      b.mesh.children.forEach((c) => {
        c.visible = matched;
      });
      b.label.visible = matched && (showLabels || isSel || isHover || dim);
    });
  }, [assets, sortKey, tierKey, query, matchedIds, selectedId, hoveredId, showLabels]);

  const statusText = (a: Asset) =>
    a.status === 'online' ? '🟢 Online' : isMuted(a) ? '🟡 Offline (tạm tắt cảnh báo)' : '🔴 Offline';

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white py-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <button className="btn btn-outline-dark btn-sm d-flex align-items-center gap-1" onClick={onBack}>
            <i className="bi bi-arrow-left"></i> Quay lại Cây 3D
          </button>
          <span className="fw-bold text-success">
            <i className="bi bi-box-fill me-2"></i> Mô hình 3D: {selectedTier?.name}
          </span>
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 px-3 shadow-sm" onClick={onOpenInventory}>
            <i className="bi bi-list-check"></i> Mở Bảng Kiểm Kê Tài Sản
          </button>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
          <div className="input-group input-group-sm" style={{ maxWidth: 340 }}>
            <span className="input-group-text"><i className="bi bi-search"></i></span>
            <input
              className="form-control"
              placeholder="Tìm theo MAC, hostname, serial..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="btn btn-outline-secondary" type="button" onClick={() => setQuery('')} title="Xóa tìm kiếm">
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 230 }}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="default">Sắp xếp: Mặc định</option>
            <option value="mac">Sắp xếp theo MAC</option>
            <option value="hostname">Sắp xếp theo Hostname</option>
            <option value="serial">Sắp xếp theo Serial</option>
          </select>
          <div className="form-check form-switch mb-0">
            <input className="form-check-input" type="checkbox" id="show-labels" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            <label className="form-check-label small" htmlFor="show-labels">Hiện nhãn</label>
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="Chế độ chuột">
            <button
              type="button"
              className={`btn ${mouseMode === 'rotate' ? 'btn-dark' : 'btn-outline-dark'}`}
              onClick={() => setMouseMode('rotate')}
              title="Chuột trái: xoay camera • Chuột phải: dịch chuyển"
            >
              <i className="bi bi-arrow-repeat me-1"></i> Xoay
            </button>
            <button
              type="button"
              className={`btn ${mouseMode === 'pan' ? 'btn-dark' : 'btn-outline-dark'}`}
              onClick={() => setMouseMode('pan')}
              title="Chuột trái: kéo dịch chuyển • Chuột phải: xoay camera"
            >
              <i className="bi bi-arrows-move me-1"></i> Di chuyển
            </button>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => topRef.current?.()}>
            <i className="bi bi-arrows-fullscreen me-1"></i> Nhìn từ trên
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => fitRef.current?.()}>
            <i className="bi bi-bullseye me-1"></i> Về góc nhìn gốc
          </button>
          <span className="small text-muted ms-auto">
            {query.trim() ? `${matchedIds.size} thiết bị khớp` : `${devices.length} thiết bị • ${offlineCount} offline`}
          </span>
        </div>
      </div>

      <div className="card-body p-0 position-relative" style={{ background: '#f8f9fa' }}>
        <div ref={mountRef} style={{ width: '100%', height: '640px', overflow: 'hidden' }} />

        {assets.length === 0 && (
          <div className="position-absolute top-50 start-50 translate-middle text-muted small text-center">
            Tầng này chưa có thiết bị nào.
          </div>
        )}

        {tooltip && (
          <div
            className="position-absolute bg-dark text-white p-2 rounded shadow-lg border border-secondary small"
            style={{ left: tooltip.x, top: tooltip.y, pointerEvents: 'none', zIndex: 20, minWidth: 220 }}
          >
            <div className="fw-bold border-bottom pb-1 mb-1">{tooltip.asset.hostname || tooltip.asset.it_asset_code}</div>
            <div>MAC: <span className="font-monospace text-info">{tooltip.asset.mac_address || 'N/A'}</span></div>
            <div>SN: <span className="font-monospace">{tooltip.asset.serial_number || 'N/A'}</span></div>
            <div>{statusText(tooltip.asset)}</div>
          </div>
        )}

        {selected && (
          <div className="position-absolute top-0 end-0 m-2 card shadow border-0" style={{ width: 300, zIndex: 30 }}>
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-2">
              <span className="fw-bold text-truncate">{selected.hostname || selected.it_asset_code}</span>
              <button className="btn-close btn-close-white" aria-label="Đóng" onClick={() => setSelectedId(null)}></button>
            </div>
            <div className="card-body small py-2">
              <table className="table table-sm table-borderless mb-0">
                <tbody>
                  <tr><td className="text-muted">Hostname</td><td className="font-monospace">{selected.hostname || '—'}</td></tr>
                  <tr><td className="text-muted">MAC</td><td className="font-monospace text-info">{selected.mac_address || 'N/A'}</td></tr>
                  <tr><td className="text-muted">Serial</td><td className="font-monospace">{selected.serial_number || '—'}</td></tr>
                  <tr><td className="text-muted">IT Code</td><td className="font-monospace">{selected.it_asset_code}</td></tr>
                  <tr><td className="text-muted">Loại</td><td>{selected.category || '—'}{selected.product ? ` • ${selected.product}` : ''}</td></tr>
                  <tr><td className="text-muted">Line</td><td>{selected.production_line || '—'}</td></tr>
                  <tr><td className="text-muted">Người dùng</td><td>{selected.assigned_to || '—'}{selected.department ? ` (${selected.department})` : ''}</td></tr>
                  <tr><td className="text-muted">PO/Invoice</td><td className="font-monospace">{selected.po_invoice || '—'}</td></tr>
                  {parentOfSelected && (
                    <tr><td className="text-muted">Gắn vào PC</td><td className="font-monospace">{parentOfSelected.hostname || parentOfSelected.it_asset_code}</td></tr>
                  )}
                  <tr><td className="text-muted">Trạng thái</td><td>{statusText(selected)}</td></tr>
                  <tr>
                    <td className="text-muted">Lần cuối thấy</td>
                    <td>{selected.last_seen_at ? new Date(selected.last_seen_at).toLocaleString('vi-VN') : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="position-absolute bottom-0 start-0 m-2 px-2 py-1 bg-white border rounded small shadow-sm d-flex flex-wrap align-items-center gap-3">
          <span><span style={{ color: hex(KIND_COLOR.pc) }}>■</span> PC / Laptop</span>
          <span><span style={{ color: hex(KIND_COLOR.printer) }}>■</span> Máy in</span>
          <span><span style={{ color: hex(KIND_COLOR.monitor) }}>■</span> Monitor</span>
          <span><span style={{ color: hex(OFFLINE_COLOR) }}>■</span> Offline</span>
          <span><span style={{ color: hex(MUTED_COLOR) }}>■</span> Tạm tắt cảnh báo</span>
          <span className="text-muted">
            <i className="bi bi-mouse me-1"></i>Kéo: xoay/dịch • Cuộn: zoom tới con trỏ • <strong>W A S D</strong> hoặc mũi tên: bay • <strong>Q/E</strong>: xuống/lên • <strong>Shift</strong>: nhanh • Double-click: bay tới thiết bị
          </span>
        </div>
      </div>
    </div>
  );
};