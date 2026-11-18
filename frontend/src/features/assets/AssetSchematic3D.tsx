import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Asset, TreeNode } from '../../types/asset.types';
import { buildTierPlan } from './schematic3dLayout';
import { buildScene, COLORS, disposeObject, setGlow, type SceneBuild } from './assetScene3D';

interface AssetSchematic3DProps {
  selectedTier: TreeNode | null;
  assets: Asset[];
  onBack: () => void;
  onOpenInventory: () => void;
}

interface Ctx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  build: SceneBuild | null;
  hovered: number | null;
  framedKey: string | null;
  frame: () => void;
}

interface Tip {
  x: number;
  y: number;
  w: number;
  asset: Asset;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Mô hình 3D của 1 tầng: hộp kính chứa các line; màn hình + PC lơ lửng, máy in dưới sàn, dây xanh lá nối màn hình–PC. */
export function AssetSchematic3D({ selectedTier, assets, onBack, onOpenInventory }: AssetSchematic3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const stats = useMemo(() => {
    const online = assets.filter((a) => a.status === 'online').length;
    return { total: assets.length, online, offline: assets.length - online };
  }, [assets]);

  // 1) Khởi tạo renderer / camera / điều khiển / vòng lặp vẽ (chỉ 1 lần)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.domElement.style.cursor = 'grab';
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // không cho chui xuống dưới sàn

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-6, 6, -8);
    scene.add(fill);

    const ctx: Ctx = { scene, camera, controls, build: null, hovered: null, framedKey: null, frame: () => {} };
    ctxRef.current = ctx;

    // rê chuột vào thiết bị -> sáng lên + hiện thông tin
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      if (!ctx.build) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(ctx.build.pickables, false)[0];
      const asset = hit ? ctx.build.assetByMesh.get(hit.object) : undefined;
      const id = asset ? asset.id : null;
      if (id !== ctx.hovered) {
        if (ctx.hovered !== null) setGlow(ctx.build.fillsByAsset.get(ctx.hovered), false);
        if (id !== null) setGlow(ctx.build.fillsByAsset.get(id), true);
        ctx.hovered = id;
        renderer.domElement.style.cursor = id !== null ? 'pointer' : 'grab';
      }
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
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      ctxRef.current = null;
    };
  }, []);

  // 2) Dựng lại mô hình mỗi khi danh sách tài sản / tầng thay đổi (không tạo lại renderer)
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

    ctx.frame = () => {
      const center = build.bounds.getCenter(new THREE.Vector3());
      const size = build.bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.z * 1.4, size.y) * 0.9;
      ctx.camera.position.set(center.x + radius * 0.35, center.y + radius * 0.85, center.z + radius * 1.05);
      ctx.controls.target.copy(center);
      ctx.controls.update();
    };
    // chỉ tự căn camera lần đầu có dữ liệu của mỗi tầng, tránh giật khi bạn đang xoay
    const key = `${selectedTier?.id ?? 0}:${assets.length > 0 ? 'data' : 'empty'}`;
    if (ctx.framedKey !== key) {
      ctx.framedKey = key;
      ctx.frame();
    }
  }, [assets, selectedTier]);

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
            {stats.total} thiết bị • <span className="text-success">{stats.online} online</span> •{' '}
            <span className="text-danger">{stats.offline} offline</span>
          </span>
        </span>
        <div className="d-flex gap-2">
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

      <div className="card-body p-0 position-relative" style={{ height: '760px', background: '#f8f9fa' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        {tip && (
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
            <div className="fw-bold text-truncate">{tip.asset.hostname || tip.asset.it_asset_code}</div>
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

        <div className="position-absolute bottom-0 start-0 m-2 px-2 py-1 bg-white text-dark border rounded small shadow-sm">
          <i className="bi bi-compass-fill text-primary me-1"></i> <strong>Kéo chuột:</strong> Xoay | <strong>Cuộn:</strong> Zoom |{' '}
          <strong>Chuột phải kéo:</strong> Di chuyển | <strong>Rê chuột:</strong> Xem thiết bị
        </div>
      </div>
    </div>
  );
}
