import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import * as THREE from 'three';
import type { Asset, TreeNode } from '../../types/asset.types';
import { apiErrorMessage, assetService, type Placement, type StockResult } from '../../services/assetService';
import { buildTierPlan, insertionPoint } from './schematic3dLayout';
import { buildScene, COLORS, disposeObject, highlightFrame, setGlow, showInsertMarker, type LineFrame, type SceneBuild } from './assetScene3D';
import { isMonitor, isPrinter, isStock } from './assetUtils';
import { StockSidebar } from './StockSidebar';
import { FirstPersonControls } from './firstPersonControls';
import { focusPose, viewPose, type Pose, type ViewName } from './cameraViews';

interface AssetSchematic3DProps {
  selectedTier: TreeNode | null;
  assets: Asset[];
  onBack: () => void;
  onOpenInventory: () => void;
  /** Gọi sau khi biên chế / hoàn tác để trang cha tải lại danh sách tài sản của tầng */
  onAssetsChanged?: () => void;
}

interface Ctx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: FirstPersonControls;
  build: SceneBuild | null;
  hovered: number | null;
  hoverLine: string | null; // line đang sáng vì có thiết bị kéo ngang qua
  dropPc: number | null; // PC đang sáng vì màn hình sắp được thả lên
  framedKey: string | null;
  frame: () => void;
  fly: Pose | null; // camera đang bay mượt tới tư thế này
  view: (name: ViewName) => void;
  rayAt: (clientX: number, clientY: number) => THREE.Raycaster;
}

interface Tip {
  x: number;
  y: number;
  w: number;
  asset: Asset;
}

interface Toast {
  kind: 'success' | 'danger';
  text: string;
  undo?: () => void;
}

/** Thiết bị sắp rơi vào đâu: lên 1 PC (màn hình), vào 1 line (x = vị trí tính từ đầu line), hoặc về Kho */
type DropTarget = { kind: 'pc'; pc: Asset } | { kind: 'line'; frame: LineFrame; x: number } | { kind: 'stock' };

/** Kéo 1 thiết bị đang nằm trong sơ đồ: chỉ coi là kéo khi con trỏ đã dịch quá ngần này (px), còn lại là click */
const MOVE_THRESHOLD = 6;

interface MoveActions {
  begin: (asset: Asset) => void;
  move: (asset: Asset, clientX: number, clientY: number) => void;
  end: (asset: Asset, clientX: number, clientY: number) => void;
  cancel: () => void;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const nameOf = (a: Asset) => a.hostname || a.it_asset_code;
const EMPTY_STOCK: StockResult = { items: [], total: 0 };

/**
 * Mô hình 3D của 1 tầng (hộp kính chứa các line) + Kho thiết bị ở thanh bên phải.
 * Hybrid: thiết bị có đủ node + Line thì tự nằm trong line; thiết bị chưa rõ vị trí nằm trong Kho,
 * IT kéo từ Kho thả vào khung line (hoặc thả màn hình lên PC) để biên chế nhanh.
 */
export function AssetSchematic3D({ selectedTier, assets, onBack, onOpenInventory, onAssetsChanged }: AssetSchematic3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Asset | null>(null);
  const actionsRef = useRef<MoveActions | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const [tip, setTip] = useState<Tip | null>(null);
  const [stockOpen, setStockOpen] = useState(true);
  const [stock, setStock] = useState<StockResult>(EMPTY_STOCK);
  const [stockLoaded, setStockLoaded] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [stockReload, setStockReload] = useState(0);
  const [dragging, setDragging] = useState<Asset | null>(null);
  const [moveActive, setMoveActive] = useState(false); // đang kéo 1 thiết bị có sẵn trong sơ đồ (khác kéo từ Kho)
  const [overStock, setOverStock] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Chỉ tính thiết bị đã vào line (thiết bị trong Kho hiện ở thanh bên phải)
  const stats = useMemo(() => {
    const placed = assets.filter((a) => !isStock(a));
    const online = placed.filter((a) => a.status === 'online').length;
    return { total: placed.length, online, offline: placed.length - online };
  }, [assets]);

  // ---------------------------------------------------------------- Kho
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        assetService
          .getStock(stockSearch)
          .then((result) => {
            if (cancelled) return;
            setStock(result);
            setStockLoaded(true);
          })
          .catch((error) => {
            if (!cancelled) console.error('Không tải được Kho thiết bị:', error);
          });
      },
      stockSearch ? 300 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [stockSearch, stockReload]);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 8000);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const refreshAfterChange = useCallback(() => {
    setStockReload((n) => n + 1);
    onAssetsChanged?.();
  }, [onAssetsChanged]);

  // ---------------------------------------------------------------- 3D: khởi tạo (1 lần)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.domElement.style.cursor = 'grab';
    mount.appendChild(renderer.domElement);

    // Camera góc nhìn thứ nhất: đứng tại chỗ quay đầu nhìn quanh (không xoay quanh tâm cảnh)
    const controls = new FirstPersonControls(camera, renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-6, 6, -8);
    scene.add(fill);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const rayAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster;
    };

    const ctx: Ctx = { scene, camera, controls, build: null, hovered: null, hoverLine: null, dropPc: null, framedKey: null, frame: () => {}, fly: null, view: () => {}, rayAt };
    ctxRef.current = ctx;

    // Kéo thiết bị đang nằm trong sơ đồ. Nhấn vào thiết bị thì tắt xoay camera; nhấn ra khoảng trống vẫn xoay như cũ.
    let press: { asset: Asset; x: number; y: number; active: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !ctx.build) return;
      const hit = rayAt(e.clientX, e.clientY).intersectObjects(ctx.build.pickables, false)[0];
      const asset = hit ? ctx.build.assetByMesh.get(hit.object) : undefined;
      if (!asset) return;
      press = { asset, x: e.clientX, y: e.clientY, active: false };
      controls.enabled = false;
      window.addEventListener('pointermove', onWinMove);
      window.addEventListener('pointerup', onWinUp);
      window.addEventListener('pointercancel', onWinCancel);
    };
    const stopPress = () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinCancel);
      controls.enabled = true;
      renderer.domElement.style.cursor = 'grab';
      press = null;
    };
    const onWinMove = (e: PointerEvent) => {
      if (!press) return;
      if (!press.active) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < MOVE_THRESHOLD) return;
        press.active = true;
        renderer.domElement.style.cursor = 'grabbing';
        actionsRef.current?.begin(press.asset);
      }
      actionsRef.current?.move(press.asset, e.clientX, e.clientY);
    };
    const onWinUp = (e: PointerEvent) => {
      const p = press;
      stopPress();
      if (p?.active) actionsRef.current?.end(p.asset, e.clientX, e.clientY);
    };
    const onWinCancel = () => {
      const wasActive = press?.active;
      stopPress();
      if (wasActive) actionsRef.current?.cancel();
    };
    mount.addEventListener('pointerdown', onDown, { capture: true }); // chạy trước điều khiển camera (gắn ở canvas)

    // rê chuột vào thiết bị -> sáng lên + hiện thông tin
    const onMove = (e: PointerEvent) => {
      if (!ctx.build || press?.active) return;
      const hit = rayAt(e.clientX, e.clientY).intersectObjects(ctx.build.pickables, false)[0];
      const asset = hit ? ctx.build.assetByMesh.get(hit.object) : undefined;
      const id = asset ? asset.id : null;
      if (id !== ctx.hovered) {
        if (ctx.hovered !== null) setGlow(ctx.build.fillsByAsset.get(ctx.hovered), false);
        if (id !== null) setGlow(ctx.build.fillsByAsset.get(id), true);
        ctx.hovered = id;
        renderer.domElement.style.cursor = id !== null ? 'pointer' : 'grab';
      }
      const rect = renderer.domElement.getBoundingClientRect();
      setTip(asset ? { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, asset } : null);
    };
    const onLeave = () => {
      if (ctx.build && ctx.hovered !== null) setGlow(ctx.build.fillsByAsset.get(ctx.hovered), false);
      ctx.hovered = null;
      setTip(null);
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(resize); // cũng chạy khi bật/tắt thanh Kho làm đổi bề rộng
    ro.observe(mount);

    // Phím WASD / mũi tên: tịnh tiến camera trên mặt sàn, Q/E: xuống / lên, giữ Shift: nhanh gấp 3. Chỉ nhận khi chuột đang ở trên sơ đồ.
    const keys = new Set<string>();
    let overCanvas = false;
    let shift = false;
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    const moveKey = (k: string) => ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k);
    const onKeyDown = (e: KeyboardEvent) => {
      shift = e.shiftKey;
      const k = e.key.toLowerCase();
      if (!overCanvas || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey || !moveKey(k)) return;
      keys.add(k);
      ctx.fly = null;
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      shift = e.shiftKey;
      keys.delete(e.key.toLowerCase());
    };
    const onEnter = () => (overCanvas = true);
    const onOut = () => {
      overCanvas = false;
      keys.clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onOut);
    mount.addEventListener('pointerenter', onEnter);
    mount.addEventListener('pointerleave', onOut);
    controls.onStart(() => (ctx.fly = null)); // người dùng tự điều khiển thì dừng chuyến bay

    // double-click vào thiết bị hoặc khung line: camera bay tới zoom vào line đó
    const onDblClick = (e: MouseEvent) => {
      if (!ctx.build) return;
      const ray = rayAt(e.clientX, e.clientY);
      const hit = ray.intersectObjects(ctx.build.pickables, false)[0];
      const asset = hit ? ctx.build.assetByMesh.get(hit.object) : undefined;
      const line = (asset?.production_line ?? '').trim();
      let frame = asset ? ctx.build.frames.find((f) => f.line === line) : undefined;
      if (!frame) {
        const fh = ray.intersectObjects(ctx.build.frames.map((f) => f.mesh), false)[0];
        frame = fh ? ctx.build.frames.find((f) => f.mesh === fh.object) : undefined;
      }
      if (!frame) return;
      const box = new THREE.Box3().setFromObject(frame.mesh);
      const p = camera.position;
      const t = controls.target;
      ctx.fly = focusPose([box.min.x, box.min.y, box.min.z], [box.max.x, box.max.y, box.max.z], [p.x, p.y, p.z], [t.x, t.y, t.z], camera.fov, camera.aspect);
    };
    renderer.domElement.addEventListener('dblclick', onDblClick);

    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const move = new THREE.Vector3();
    const flyTarget = new THREE.Vector3();
    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (keys.size > 0) {
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); // đang nhìn thẳng xuống: lấy "phía trước" theo màn hình
        fwd.normalize();
        right.crossVectors(fwd, camera.up).normalize();
        move.set(0, 0, 0);
        if (keys.has('w') || keys.has('arrowup')) move.add(fwd);
        if (keys.has('s') || keys.has('arrowdown')) move.sub(fwd);
        if (keys.has('d') || keys.has('arrowright')) move.add(right);
        if (keys.has('a') || keys.has('arrowleft')) move.sub(right);
        if (keys.has('e')) move.y += 1;
        if (keys.has('q')) move.y -= 1;
        if (move.lengthSq() > 0) {
          const speed = Math.max(2, controls.scale * 1.2) * (shift ? 3 : 1);
          controls.translate(move.normalize().multiplyScalar(speed * dt));
        }
      }
      if (ctx.fly) {
        const k = 1 - Math.pow(0.0005, dt); // bay mượt, ~0.5 giây
        const goal = new THREE.Vector3(...ctx.fly.pos);
        const goalTarget = new THREE.Vector3(...ctx.fly.target);
        camera.position.lerp(goal, k);
        controls.lookAt(flyTarget.copy(controls.target).lerp(goalTarget, k));
        if (camera.position.distanceTo(goal) < 0.03 && controls.target.distanceTo(goalTarget) < 0.03) ctx.fly = null;
      }
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onOut);
      mount.removeEventListener('pointerenter', onEnter);
      mount.removeEventListener('pointerleave', onOut);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      mount.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinCancel);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      ctxRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------- 3D: dựng lại khi dữ liệu đổi
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (ctx.build) {
      ctx.scene.remove(ctx.build.group);
      disposeObject(ctx.build.group);
    }
    const build = buildScene(buildTierPlan(assets), selectedTier?.name ?? 'Khu vực sản xuất');
    ctx.scene.add(build.group);
    ctx.build = build;
    ctx.hovered = null;
    ctx.hoverLine = null;
    ctx.dropPc = null;

    const { min, max } = build.bounds;
    const poseOf = (name: ViewName) => viewPose(name, [min.x, min.y, min.z], [max.x, max.y, max.z], ctx.camera.fov, ctx.camera.aspect);
    ctx.frame = () => {
      const pose = poseOf('iso');
      ctx.fly = null;
      ctx.camera.position.set(...pose.pos);
      ctx.controls.lookAt(new THREE.Vector3(...pose.target));
    };
    ctx.controls.scale = Math.max(2, Math.max(max.x - min.x, max.z - min.z) * 0.12); // bước đi / trượt tỉ lệ với cỡ tầng
    ctx.view = (name) => {
      ctx.fly = poseOf(name);
    };
    // chỉ tự căn camera lần đầu có dữ liệu của mỗi tầng, tránh giật khi bạn đang xoay hoặc vừa biên chế xong
    const key = `${selectedTier?.id ?? 0}:${assets.some((a) => !isStock(a)) ? 'data' : 'empty'}`;
    if (ctx.framedKey !== key) {
      ctx.framedKey = key;
      ctx.frame();
    }
  }, [assets, selectedTier]);

  // ---------------------------------------------------------------- kéo thả (từ Kho hoặc ngay trong sơ đồ)
  /** Thiết bị đang kéo sắp rơi vào đâu? PC (nếu là màn hình) hoặc khung line (kèm vị trí x); ngoài ra là không hợp lệ. */
  const pickTarget = (clientX: number, clientY: number, dragged: Asset): DropTarget | null => {
    const ctx = ctxRef.current;
    if (!ctx || !ctx.build) return null;
    const build = ctx.build;
    const ray = ctx.rayAt(clientX, clientY);

    // bỏ qua chính thiết bị đang kéo (nó vẫn nằm tại chỗ cũ trong sơ đồ)
    const hit = ray.intersectObjects(build.pickables, false).find((h) => build.assetByMesh.get(h.object)?.id !== dragged.id);
    const hitAsset = hit ? build.assetByMesh.get(hit.object) : undefined;
    if (hit && hitAsset) {
      if (isMonitor(dragged) && !isMonitor(hitAsset) && !isPrinter(hitAsset)) return { kind: 'pc', pc: hitAsset };
      const line = (hitAsset.production_line ?? '').trim();
      const frame = build.frames.find((f) => f.line === line);
      if (frame) return { kind: 'line', frame, x: hit.point.x - frame.plan.x0 };
    }
    const fh = ray.intersectObjects(
      build.frames.map((f) => f.mesh),
      false,
    )[0];
    const frame = fh ? build.frames.find((f) => f.mesh === fh.object) : undefined;
    return fh && frame ? { kind: 'line', frame, x: fh.point.x - frame.plan.x0 } : null;
  };

  const clearDropHighlight = () => {
    const ctx = ctxRef.current;
    if (!ctx || !ctx.build) return;
    if (ctx.hoverLine !== null) {
      ctx.hoverLine = null;
      highlightFrame(ctx.build.frames, null);
    }
    if (ctx.dropPc !== null) {
      setGlow(ctx.build.fillsByAsset.get(ctx.dropPc), false);
      ctx.dropPc = null;
    }
    showInsertMarker(ctx.build, null);
  };

  /** Sáng khung line / PC đích và hiện vạch xanh ở chỗ thiết bị sẽ đứng trong line */
  const updateHover = (target: DropTarget | null, dragged: Asset) => {
    const ctx = ctxRef.current;
    if (!ctx || !ctx.build) return;
    const line = !target || target.kind === 'stock' ? null : target.kind === 'pc' ? (target.pc.production_line ?? '').trim() : target.frame.line;
    if (line !== ctx.hoverLine) {
      ctx.hoverLine = line;
      highlightFrame(ctx.build.frames, line);
    }
    const pcId = target && target.kind === 'pc' ? target.pc.id : null;
    if (pcId !== ctx.dropPc) {
      if (ctx.dropPc !== null) setGlow(ctx.build.fillsByAsset.get(ctx.dropPc), false);
      if (pcId !== null) setGlow(ctx.build.fillsByAsset.get(pcId), true);
      ctx.dropPc = pcId;
    }
    if (target && target.kind === 'line') showInsertMarker(ctx.build, target.frame, insertionPoint(target.frame.plan, dragged, target.x).markerX);
    else showInsertMarker(ctx.build, null);
  };

  const placeAsset = async (dragged: Asset, target: DropTarget) => {
    const tierId = selectedTier?.id ?? null;
    let placement: Placement;
    if (target.kind === 'stock') {
      placement = { node_id: dragged.node_id, production_line: null, parent_asset_id: null, line_order: null };
    } else if (target.kind === 'pc') {
      placement = { node_id: target.pc.node_id ?? tierId, production_line: target.pc.production_line, parent_asset_id: target.pc.id, line_order: null };
    } else {
      placement = {
        node_id: target.frame.nodeId ?? tierId,
        production_line: target.frame.line,
        parent_asset_id: null,
        line_order: insertionPoint(target.frame.plan, dragged, target.x).order,
      };
    }
    // vị trí cũ để hoàn tác
    const wasStock = isStock(dragged);
    const previous: Placement = {
      node_id: dragged.node_id,
      production_line: wasStock ? null : dragged.production_line,
      parent_asset_id: dragged.parent_asset_id ?? null,
      line_order: dragged.line_order ?? null,
    };
    const from = wasStock ? 'Kho' : (dragged.production_line ?? '').trim();
    try {
      await assetService.placeAsset(dragged.id, placement);
      refreshAfterChange();
      const to = target.kind === 'stock' ? 'Kho' : target.kind === 'pc' ? `PC ${nameOf(target.pc)}` : target.frame.line;
      const moved = wasStock ? 'Đã đưa' : target.kind === 'stock' ? 'Đã trả' : 'Đã chuyển';
      showToast({
        kind: 'success',
        text: `${moved} ${nameOf(dragged)} ${target.kind === 'stock' ? 'về' : wasStock ? 'vào' : 'tới'} ${to}.`,
        undo: async () => {
          try {
            await assetService.placeAsset(dragged.id, previous);
            refreshAfterChange();
            showToast({ kind: 'success', text: `Đã hoàn tác: ${nameOf(dragged)} quay về ${from || 'vị trí cũ'}.` });
          } catch (error) {
            showToast({ kind: 'danger', text: apiErrorMessage(error, 'Không hoàn tác được.') });
          }
        },
      });
    } catch (error) {
      showToast({ kind: 'danger', text: apiErrorMessage(error, 'Không di chuyển được thiết bị.') });
    }
  };

  /** Kết thúc kéo thả: target = null nghĩa là thả ngoài mọi khung line */
  const finishDrop = (dragged: Asset, target: DropTarget | null) => {
    clearDropHighlight();
    if (!target) {
      showToast({ kind: 'danger', text: 'Hãy thả vào bên trong khung của một line (viền xanh) hoặc vào Kho.' });
      return;
    }
    if (target.kind === 'pc' && dragged.parent_asset_id === target.pc.id) return; // đã gắn vào PC này rồi
    void placeAsset(dragged, target);
  };

  // --- HTML5 drag (kéo từ thanh Kho)
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    const dragged = dragRef.current;
    const ctx = ctxRef.current;
    if (!dragged || !ctx || !ctx.build) return;
    e.preventDefault(); // cho phép thả
    const target = pickTarget(e.clientX, e.clientY, dragged);
    e.dataTransfer.dropEffect = target ? 'move' : 'none';
    updateHover(target, dragged);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) clearDropHighlight();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const dragged = dragRef.current;
    if (!dragged) return;
    e.preventDefault();
    finishDrop(dragged, pickTarget(e.clientX, e.clientY, dragged));
  };

  // --- kéo thiết bị đang nằm trong sơ đồ (pointer events, xem effect khởi tạo)
  const overStockAt = (clientX: number, clientY: number) => !!document.elementFromPoint(clientX, clientY)?.closest('[data-stock-drop]');
  const resetMove = () => {
    setDragging(null);
    setMoveActive(false);
    setOverStock(false);
    setGhost(null);
    clearDropHighlight();
  };
  actionsRef.current = {
    begin: (asset) => {
      setTip(null);
      setDragging(asset);
      setMoveActive(true);
    },
    move: (asset, x, y) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) setGhost({ x: x - rect.left, y: y - rect.top });
      const toStock = overStockAt(x, y);
      setOverStock(toStock);
      if (toStock) {
        updateHover(null, asset);
        return;
      }
      updateHover(pickTarget(x, y, asset), asset);
    },
    end: (asset, x, y) => {
      const toStock = overStockAt(x, y);
      const target: DropTarget | null = toStock ? { kind: 'stock' } : pickTarget(x, y, asset);
      resetMove();
      finishDrop(asset, target);
    },
    cancel: resetMove,
  };

  const legend: { label: string; color: number }[] = [
    { label: 'Monitor', color: COLORS.monitor },
    { label: 'PC', color: COLORS.pc },
    { label: 'Máy in', color: COLORS.printer },
    { label: 'Line', color: COLORS.line },
    { label: 'Dây màn hình–PC', color: COLORS.wire },
    { label: 'Offline', color: COLORS.offline },
  ];

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
        <button className="btn btn-outline-dark btn-sm d-flex align-items-center gap-1" onClick={onBack}>
          <i className="bi bi-arrow-left"></i> Quay lại Cây 3D
        </button>
        <span className="fw-bold text-success">
          <i className="bi bi-box-seam me-2"></i> Mô hình 3D: {selectedTier?.name}
          <span className="ms-2 small fw-normal text-muted">
            {stats.total} thiết bị trong line • <span className="text-success">{stats.online} online</span> •{' '}
            <span className="text-danger">{stats.offline} offline</span>
          </span>
        </span>
        <div className="d-flex gap-2">
          <button
            className={`btn btn-sm ${stockOpen ? 'btn-warning' : 'btn-outline-warning text-dark'}`}
            onClick={() => setStockOpen((v) => !v)}
          >
            <i className="bi bi-box-seam me-1"></i> Kho ({stock.total})
          </button>
          <div className="btn-group btn-group-sm" role="group" aria-label="Góc nhìn">
            {([['iso', 'Chéo'], ['top', 'Trên xuống'], ['front', 'Trước'], ['left', 'Trái'], ['right', 'Phải']] as [ViewName, string][]).map(([name, text]) => (
              <button key={name} className="btn btn-outline-primary" onClick={() => ctxRef.current?.view(name)}>
                {text}
              </button>
            ))}
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => ctxRef.current?.frame()}>
            <i className="bi bi-arrows-fullscreen me-1"></i> Căn lại khung nhìn
          </button>
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 px-3 shadow-sm" onClick={onOpenInventory}>
            <i className="bi bi-list-check"></i> Mở Bảng Kiểm Kê Tài Sản
          </button>
        </div>
        <div className="d-flex align-items-center flex-wrap gap-2 small bg-light px-3 py-2 rounded border w-100">
          <span className="fw-bold text-secondary me-1">Chú thích:</span>
          {legend.map((l) => (
            <span key={l.label} className="d-inline-flex align-items-center gap-1">
              <span style={{ width: 12, height: 12, background: hex(l.color), display: 'inline-block', borderRadius: 2 }}></span>
              {l.label}
            </span>
          ))}
          <span className="text-muted">| Màn hình &amp; PC lơ lửng, máy in đặt dưới sàn</span>
        </div>
      </div>

      <div className="card-body p-0 d-flex" style={{ height: '760px', background: hex(COLORS.background) }}>
        <div
          ref={wrapRef}
          className="position-relative flex-grow-1"
          style={{ minWidth: 0 }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

          {tip && !dragging && (
            <div
              className="position-absolute bg-dark text-white rounded shadow small p-2"
              style={{
                left: tip.x > tip.w - 260 ? tip.x - 250 : tip.x + 14,
                top: tip.y + 14,
                width: 236,
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <div className="fw-bold text-truncate">{nameOf(tip.asset)}</div>
              <div className="opacity-75">{[tip.asset.category, tip.asset.product].filter(Boolean).join(' • ') || '—'}</div>
              <div>
                IT Code: <span className="font-monospace">{tip.asset.it_asset_code}</span>
              </div>
              {tip.asset.assigned_to && <div>Người dùng: {tip.asset.assigned_to}</div>}
              <div className={tip.asset.status === 'online' ? 'text-success' : 'text-danger'}>
                {tip.asset.status === 'online' ? '🟢 Online' : '🔴 Offline'}
              </div>
            </div>
          )}

          {dragging && (
            <div
              className="position-absolute top-0 start-50 translate-middle-x mt-2 px-3 py-2 rounded shadow small bg-success text-white"
              style={{ pointerEvents: 'none', zIndex: 6 }}
            >
              {moveActive ? 'Đang di chuyển' : 'Đang kéo'} <strong>{nameOf(dragging)}</strong>: thả vào khung line (vạch xanh = chỗ sẽ đứng)
              {isMonitor(dragging) && ' · thả lên một PC để gắn màn hình'}
              {moveActive && ' · thả vào Kho để trả về'}
            </div>
          )}

          {moveActive && dragging && ghost && (
            <div
              className="position-absolute bg-dark text-white border border-success rounded shadow-sm small px-2 py-1 fw-bold"
              style={{ left: ghost.x + 14, top: ghost.y + 14, pointerEvents: 'none', zIndex: 8, opacity: 0.92 }}
            >
              <i className="bi bi-arrows-move text-success me-1"></i>
              {nameOf(dragging)}
            </div>
          )}

          {moveActive && !stockOpen && (
            <div
              data-stock-drop
              className={`position-absolute end-0 bottom-0 m-3 px-4 py-3 rounded border border-2 border-warning text-center fw-bold small ${
                overStock ? 'bg-warning' : 'bg-warning-subtle'
              }`}
              style={{ zIndex: 6, borderStyle: 'dashed' }}
            >
              <i className="bi bi-box-arrow-in-down me-1"></i> Thả vào đây để trả về Kho
            </div>
          )}

          {toast && (
            <div
              className={`position-absolute bottom-0 start-50 translate-middle-x mb-5 px-3 py-2 rounded shadow small d-flex align-items-center gap-3 text-white ${
                toast.kind === 'success' ? 'bg-dark' : 'bg-danger'
              }`}
              style={{ zIndex: 7, maxWidth: '90%' }}
            >
              <span>{toast.text}</span>
              {toast.undo && (
                <button className="btn btn-sm btn-light py-0" onClick={toast.undo}>
                  Hoàn tác
                </button>
              )}
              <button className="btn-close btn-close-white" style={{ fontSize: 10 }} onClick={() => setToast(null)} aria-label="Đóng"></button>
            </div>
          )}

          <div className="position-absolute bottom-0 start-0 m-2 px-2 py-1 bg-dark bg-opacity-75 text-light border border-secondary rounded small shadow-sm">
            <i className="bi bi-compass-fill text-primary me-1"></i> <strong>Kéo chuột trái:</strong> Nhìn quanh | <strong>Cuộn:</strong> Tiến / lùi |{' '}
            <strong>Chuột phải kéo / WASD / mũi tên:</strong> Đi / trượt (Q/E: xuống/lên, Shift: nhanh) | <strong>Double-click:</strong> Bay tới line |{' '}
            <strong>Kéo thiết bị:</strong> Đổi chỗ / sang line khác / về Kho
          </div>
        </div>

        {stockOpen && (
          <StockSidebar
            items={stock.items}
            total={stock.total}
            loaded={stockLoaded}
            search={stockSearch}
            onSearch={setStockSearch}
            onDragStart={(a) => {
              dragRef.current = a;
              setDragging(a);
            }}
            onDragEnd={() => {
              dragRef.current = null;
              setDragging(null);
              clearDropHighlight();
            }}
            onClose={() => setStockOpen(false)}
            moving={moveActive}
            overStock={overStock}
          />
        )}
      </div>
    </div>
  );
}
