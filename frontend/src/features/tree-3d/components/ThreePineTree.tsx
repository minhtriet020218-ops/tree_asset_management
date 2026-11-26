import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TreeNode } from '../../../types/asset.types';
import type { TreeNodeStats } from '../../../types/tree.types';
import { treeService } from '../../../services/treeService';
import logoUrl from '../../../assets/xp-logo.jpg';
import { DOT_CAP, coneDots, dotCounts, dotRadius, redMask } from '../utils/treeDecor';

interface ThreePineTreeProps {
  onSelectTier: (node: TreeNode) => void;
}

const MAX_TIERS = 6;
const REFRESH_MS = 30000;
const SNOW_COUNT = 700;
// Hạt máy: độ đục của lõi (1 = đặc), độ đậm và cỡ quầng sáng (cỡ so với lõi)
const DOT_OPACITY = 0.78;
const HALO_OPACITY = 0.3;
const HALO_SCALE = 2.6;
// Khối logo trên đỉnh: độ sáng nền của logo và quầng sáng quanh khối
const LOGO_GLOW = 1.0;
const LOGO_HALO_OPACITY = 0.65;
const LOGO_HALO_SIZE = 2.6;
// Đoạn mặt nón (0 = đáy, 1 = đỉnh) được phép đặt đốm: tránh sát đỉnh (có mũ tuyết và bị tầng trên che)
const DOT_T_MIN = 0.06;
const DOT_T_MAX = 0.7;
const PINE_COLORS = [0x14532d, 0x166534, 0x15803d, 0x1a7a45, 0x1f8a4c, 0x25995a];

// Hình tròn mờ cho bông tuyết
function makeSnowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

// Các tầng của cây = mọi node không phải gốc (id nhỏ ở dưới, id lớn ở trên). Chỉ có gốc thì dùng gốc.
function pickTiers(nodes: TreeNodeStats[]): TreeNodeStats[] {
  const sorted = [...nodes].sort((a, b) => a.id - b.id);
  const nonRoot = sorted.filter((n) => n.parent_id !== null);
  return (nonRoot.length > 0 ? nonRoot : sorted).slice(0, MAX_TIERS);
}

// Màu tầng theo tình trạng: xanh = ổn, vàng = có máy offline, đỏ = offline nhiều, xám = chưa có máy
function tierColor(n?: TreeNodeStats): number {
  if (!n || n.total === 0) return 0xadb5bd;
  const ratio = n.offline / n.total;
  if (ratio === 0) return 0x20c997;
  if (ratio < 0.2) return 0xfab005;
  return 0xfa5252;
}

export const ThreePineTree: React.FC<ThreePineTreeProps> = ({ onSelectTier }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<TreeNodeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TreeNodeStats } | null>(null);

  const tiers = pickTiers(nodes);
  const tierKey = tiers.map((t) => t.id).join(',');

  // Các ref để vòng đời Three.js luôn đọc được dữ liệu mới mà không phải dựng lại scene
  const tiersRef = useRef<TreeNodeStats[]>(tiers);
  const nodesRef = useRef<Map<number, TreeNodeStats>>(new Map());
  const meshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const ringsRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const applyDecorRef = useRef<(() => void) | null>(null);
  const onSelectRef = useRef(onSelectTier);
  tiersRef.current = tiers;
  nodesRef.current = new Map(nodes.map((n) => [n.id, n]));
  onSelectRef.current = onSelectTier;

  // --- Tải số liệu thật từ API, tự làm mới ---
  const load = React.useCallback(async () => {
    try {
      setNodes(await treeService.getStats());
      setError(null);
    } catch {
      setError('Không tải được dữ liệu từ server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // --- Dựng scene (chỉ dựng lại khi danh sách tầng thay đổi) ---
  useEffect(() => {
    const mount = mountRef.current;
    const tierList = tiersRef.current;
    if (!mount || tierList.length === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1530);
    scene.fog = new THREE.Fog(0x0b1530, 14, 26);
    // Mọi thứ cần giải phóng khi dựng lại / thoát (hình học, vật liệu, texture)
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(x: T): T => {
      disposables.push(x);
      return x;
    };

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 15;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2;

    scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x1b2a1f, 0.85));
    const dirLight = new THREE.DirectionalLight(0xfff1d6, 1.1);
    dirLight.position.set(5, 15, 10);
    scene.add(dirLight);

    const treeGroup = new THREE.Group();

    const snowGround = new THREE.Mesh(
      track(new THREE.CylinderGeometry(4.8, 5.2, 0.08, 64)),
      track(new THREE.MeshStandardMaterial({ color: 0xeef3fb, roughness: 0.95 })),
    );
    snowGround.position.set(0, -2.15, 0);
    treeGroup.add(snowGround);
    // Vài đụn tuyết quanh gốc cho đỡ phẳng
    const moundGeo = track(new THREE.SphereGeometry(1, 20, 12));
    const moundMat = track(new THREE.MeshStandardMaterial({ color: 0xf8fbff, roughness: 1 }));
    ([[1.9, 1.0, 0.9], [-2.3, -0.6, 1.2], [0.6, -2.4, 0.8], [-0.9, 2.5, 0.7], [3.0, -1.4, 0.6]] as const).forEach(([x, z, r]) => {
      const m = new THREE.Mesh(moundGeo, moundMat);
      m.scale.set(r, r * 0.28, r);
      m.position.set(x, -2.1, z);
      treeGroup.add(m);
    });

    const trunk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.35, 0.35, 1.6, 32)),
      track(new THREE.MeshStandardMaterial({ color: 0x6b3f12, roughness: 0.7 })),
    );
    trunk.position.set(0, -1.3, 0);
    treeGroup.add(trunk);

    // Các tầng: số tầng tuỳ dữ liệu, tầng đầu tiên ở dưới cùng
    const count = tierList.length;
    const step = 3.9 / Math.max(count, 3);
    const meshes: THREE.Mesh[] = [];
    meshesRef.current = new Map();

    const tierGeom: { radius: number; h: number; yc: number }[] = [];
    ringsRef.current = new Map();
    const snowCapMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));

    tierList.forEach((tier, i) => {
      const radius = count === 1 ? 2.4 : 2.4 - 1.2 * (i / (count - 1));
      const h = step * 1.15;
      const yc = -0.7 + i * step;
      tierGeom.push({ radius, h, yc });

      // Tầng = nón thông xanh (màu tình trạng chuyển xuống vòng sáng ở chân tầng)
      const mesh = new THREE.Mesh(
        track(new THREE.ConeGeometry(radius, h, 32)),
        track(new THREE.MeshStandardMaterial({ color: PINE_COLORS[i % PINE_COLORS.length], roughness: 0.85, flatShading: true })),
      );
      mesh.position.set(0, yc, 0);
      mesh.userData = { nodeId: tier.id };
      treeGroup.add(mesh);
      meshes.push(mesh);
      meshesRef.current.set(tier.id, mesh);

      // Mũ tuyết phủ phần đỉnh của tầng (không bắt chuột: chuột vẫn trúng tầng bên dưới)
      const capT = 0.74;
      const cap = new THREE.Mesh(
        track(new THREE.ConeGeometry(radius * (1 - capT) * 1.07, h * (1 - capT) * 1.04, 32)),
        snowCapMat,
      );
      cap.position.set(0, yc - h / 2 + h * capT + (h * (1 - capT) * 1.04) / 2 - 0.01, 0);
      treeGroup.add(cap);

      // Vòng sáng ở chân tầng: màu theo tình trạng cả tầng (xanh / vàng / đỏ / xám)
      const ring = new THREE.Mesh(
        track(new THREE.TorusGeometry(radius * 1.005, 0.035, 8, 96)),
        track(new THREE.MeshStandardMaterial({ color: 0x20c997, emissive: 0x20c997, emissiveIntensity: 0.6, roughness: 0.4 })),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, yc - h / 2 + 0.02, 0);
      treeGroup.add(ring);
      ringsRef.current.set(tier.id, ring);
    });

    // --- Đốm đỏ / xanh = máy offline / online, rải đều trên mặt các tầng ---
    const dotGeo = track(new THREE.SphereGeometry(1, 14, 10));
    // Hạt hơi trong suốt + phát sáng: lõi bán trong suốt, thêm quầng sáng cộng màu (additive) bao quanh
    const coreMat = (color: number, emissive: number) =>
      track(new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.2, roughness: 0.15, transparent: true, opacity: DOT_OPACITY, depthWrite: false }));
    const haloMat = (color: number) =>
      track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: HALO_OPACITY, blending: THREE.AdditiveBlending, depthWrite: false }));
    const greenMat = coreMat(0x2ee66b, 0x22ff77);
    const redMat = coreMat(0xff3b3b, 0xff2222);
    const greenHaloMat = haloMat(0x2ee66b);
    const redHaloMat = haloMat(0xff3b3b);
    const capacity = MAX_TIERS * DOT_CAP;
    const greenDots = new THREE.InstancedMesh(dotGeo, greenMat, capacity);
    const redDots = new THREE.InstancedMesh(dotGeo, redMat, capacity);
    const greenHalo = new THREE.InstancedMesh(dotGeo, greenHaloMat, capacity);
    const redHalo = new THREE.InstancedMesh(dotGeo, redHaloMat, capacity);
    const glowMeshes = [greenDots, redDots, greenHalo, redHalo];
    glowMeshes.forEach((m) => {
      m.frustumCulled = false;
      m.renderOrder = 2; // vẽ sau cây (vật đặc) để trong suốt/cộng màu hiển thị đúng
    });
    treeGroup.add(...glowMeshes);
    const dummy = new THREE.Object3D();

    const applyDecor = () => {
      let gi = 0;
      let ri = 0;
      tierList.forEach((tier, i) => {
        const st = nodesRef.current.get(tier.id);
        const { green, red } = dotCounts(st?.online ?? 0, st?.offline ?? 0);
        const n = green + red;
        const g = tierGeom[i];
        if (n > 0 && g) {
          const dots = coneDots(n, g.radius, g.h, g.yc, DOT_T_MIN, DOT_T_MAX, i * 1.3);
          const isRed = redMask(n, red, tier.id);
          const r = dotRadius(n, g.radius, g.h, DOT_T_MIN, DOT_T_MAX);
          dots.forEach((d, k) => {
            dummy.position.set(d.x + d.nx * r * 1.1, d.y + d.ny * r * 1.1, d.z + d.nz * r * 1.1);
            dummy.scale.setScalar(r);
            dummy.updateMatrix();
            const haloScale = r * HALO_SCALE;
            if (isRed[k]) {
              redDots.setMatrixAt(ri, dummy.matrix);
              dummy.scale.setScalar(haloScale);
              dummy.updateMatrix();
              redHalo.setMatrixAt(ri++, dummy.matrix);
            } else {
              greenDots.setMatrixAt(gi, dummy.matrix);
              dummy.scale.setScalar(haloScale);
              dummy.updateMatrix();
              greenHalo.setMatrixAt(gi++, dummy.matrix);
            }
          });
        }
        const ring = ringsRef.current.get(tier.id);
        if (ring) {
          const hex = tierColor(st);
          const mat = ring.material as THREE.MeshStandardMaterial;
          mat.color.setHex(hex);
          mat.emissive.setHex(hex);
        }
      });
      greenDots.count = greenHalo.count = gi;
      redDots.count = redHalo.count = ri;
      glowMeshes.forEach((m) => {
        m.instanceMatrix.needsUpdate = true;
      });
    };
    applyDecorRef.current = applyDecor;
    applyDecor();

    // Đỉnh cây: khối lập phương, 4 mặt bên là logo, mặt trên/dưới đen
    const topIdx = count - 1;
    const apexY = tierGeom[topIdx].yc + tierGeom[topIdx].h / 2;
    const CUBE = 0.62;
    const logoMat = () => track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: LOGO_GLOW }));
    const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
    const sideMats = [logoMat(), logoMat(), logoMat(), logoMat()];
    const cube = new THREE.Mesh(track(new THREE.BoxGeometry(CUBE, CUBE, CUBE)), [
      sideMats[0], // +x
      sideMats[1], // -x
      darkMat, // +y
      darkMat, // -y
      sideMats[2], // +z
      sideMats[3], // -z
    ]);
    const cubeBaseY = apexY + CUBE / 2 - 0.08;
    cube.position.set(0, cubeBaseY, 0);
    treeGroup.add(cube);
    const cubeLight = new THREE.PointLight(0xfff0c8, 2.4, 6);
    cubeLight.position.set(0, cubeBaseY + 0.4, 0);
    treeGroup.add(cubeLight);

    // Quầng sáng quanh khối logo: tấm sprite luôn quay về phía camera, cộng màu (additive)
    const glowTex = track(makeSnowTexture());
    const glowMat = track(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9b0, transparent: true, opacity: LOGO_HALO_OPACITY, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const cubeGlow = new THREE.Sprite(glowMat);
    cubeGlow.scale.set(LOGO_HALO_SIZE, LOGO_HALO_SIZE, 1);
    cubeGlow.position.set(0, cubeBaseY, 0);
    cubeGlow.renderOrder = 3;
    treeGroup.add(cubeGlow);

    const logo: { tex: THREE.Texture | null; disposed: boolean } = { tex: null, disposed: false };
    new THREE.TextureLoader().load(logoUrl, (tex) => {
      if (logo.disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      logo.tex = tex;
      sideMats.forEach((m) => {
        m.map = tex;
        m.emissiveMap = tex;
        m.needsUpdate = true;
      });
    });

    // Tuyết rơi
    const snowPos = new Float32Array(SNOW_COUNT * 3);
    const snowSpeed = new Float32Array(SNOW_COUNT);
    const snowPhase = new Float32Array(SNOW_COUNT);
    for (let k = 0; k < SNOW_COUNT; k++) {
      snowPos[k * 3] = (Math.random() - 0.5) * 14;
      snowPos[k * 3 + 1] = -2.2 + Math.random() * 9;
      snowPos[k * 3 + 2] = (Math.random() - 0.5) * 14;
      snowSpeed[k] = 0.35 + Math.random() * 0.7;
      snowPhase[k] = Math.random() * Math.PI * 2;
    }
    const snowGeo = track(new THREE.BufferGeometry());
    const snowAttr = new THREE.BufferAttribute(snowPos, 3);
    snowGeo.setAttribute('position', snowAttr);
    const snowTex = track(makeSnowTexture());
    const snow = new THREE.Points(
      snowGeo,
      track(new THREE.PointsMaterial({ color: 0xffffff, size: 0.11, map: snowTex, transparent: true, depthWrite: false, sizeAttenuation: true })),
    );
    snow.frustumCulled = false;
    scene.add(snow);
    scene.add(treeGroup);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;

    const setEmissive = (m: THREE.Mesh, hex: number, intensity: number) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(hex);
      mat.emissiveIntensity = intensity;
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(meshes)[0];

      if (hit) {
        const mesh = hit.object as THREE.Mesh;
        if (hovered !== mesh) {
          if (hovered) setEmissive(hovered, 0x000000, 0);
          hovered = mesh;
          setEmissive(mesh, 0xff9900, 0.6);
          document.body.style.cursor = 'pointer';
        }
        const node = nodesRef.current.get(mesh.userData.nodeId as number);
        if (node) setTooltip({ x: event.clientX - rect.left + 15, y: event.clientY - rect.top - 40, node });
      } else {
        if (hovered) {
          setEmissive(hovered, 0x000000, 0);
          hovered = null;
          document.body.style.cursor = 'default';
        }
        setTooltip(null);
      }
    };

    const onClick = () => {
      if (!hovered) return;
      const target = hovered;
      const node = nodesRef.current.get(target.userData.nodeId as number);
      target.scale.set(1.12, 1.12, 1.12);
      setTimeout(() => target.scale.set(1, 1, 1), 200);
      if (node) onSelectRef.current(node);
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    let frameId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      for (let k = 0; k < SNOW_COUNT; k++) {
        snowPos[k * 3 + 1] -= snowSpeed[k] * dt;
        snowPos[k * 3] += Math.sin(t * 0.8 + snowPhase[k]) * 0.18 * dt;
        snowPos[k * 3 + 2] += Math.cos(t * 0.6 + snowPhase[k]) * 0.12 * dt;
        if (snowPos[k * 3 + 1] < -2.1) snowPos[k * 3 + 1] = 6.8;
      }
      snowAttr.needsUpdate = true;

      cube.rotation.y += dt * 0.7;
      cube.position.y = cubeBaseY + Math.sin(t * 1.6) * 0.04;
      cubeGlow.position.y = cube.position.y;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      sideMats.forEach((m) => {
        m.emissiveIntensity = LOGO_GLOW * (0.85 + 0.3 * pulse);
      });
      glowMat.opacity = LOGO_HALO_OPACITY * (0.8 + 0.4 * pulse);
      cubeLight.intensity = 2.4 * (0.85 + 0.3 * pulse);
      // Đỏ nhấp nháy mạnh (nhắc máy đang offline), xanh sáng đều và thở nhẹ
      redMat.emissiveIntensity = 1.2 + 0.6 * Math.sin(t * 3);
      redHaloMat.opacity = HALO_OPACITY * (0.75 + 0.45 * Math.sin(t * 3));
      greenMat.emissiveIntensity = 1.1 + 0.2 * Math.sin(t * 1.7 + 1);
      greenHaloMat.opacity = HALO_OPACITY * (0.9 + 0.15 * Math.sin(t * 1.7 + 1));

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      document.body.style.cursor = 'default';
      logo.disposed = true;
      logo.tex?.dispose();
      disposables.forEach((d) => d.dispose());
      glowMeshes.forEach((m) => m.dispose());
      applyDecorRef.current = null;
      ringsRef.current = new Map();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      meshesRef.current = new Map();
    };
  }, [tierKey]);

  // --- Số liệu mới về thì chỉ cập nhật đốm + vòng màu tầng, không dựng lại scene ---
  useEffect(() => {
    applyDecorRef.current?.();
  }, [nodes, tierKey]);

  return (
    <div className="position-relative">
      <div ref={mountRef} style={{ width: '100%', height: '450px', borderRadius: '6px', overflow: 'hidden' }} />

      {loading && (
        <div className="position-absolute top-50 start-50 translate-middle text-muted small">
          <span className="spinner-border spinner-border-sm me-2"></span>Đang tải dữ liệu...
        </div>
      )}

      {!loading && error && (
        <div className="position-absolute top-0 start-0 end-0 m-2 alert alert-danger py-2 small d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={load}>Thử lại</button>
        </div>
      )}

      {!loading && !error && tiers.length === 0 && (
        <div className="position-absolute top-50 start-50 translate-middle text-muted small text-center">
          Chưa có node nào trong bảng tree_nodes.
        </div>
      )}

      {tooltip && (
        <div
          className="position-absolute bg-dark text-white p-2 rounded shadow-lg border border-secondary small"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px`, pointerEvents: 'none', zIndex: 1000, minWidth: '180px' }}
        >
          <div className="fw-bold text-success border-bottom pb-1 mb-1" style={{ fontSize: '11.5px' }}>
            {tooltip.node.name}
          </div>
          <div className="d-flex justify-content-between">
            <span>Tổng số máy:</span>
            <span className="fw-bold">{tooltip.node.total}</span>
          </div>
          <div className="d-flex justify-content-between text-success">
            <span>🟢 Đang Online:</span>
            <span className="fw-bold">{tooltip.node.online}</span>
          </div>
          <div className="d-flex justify-content-between text-danger">
            <span>🔴 Đang Offline:</span>
            <span className="fw-bold">{tooltip.node.offline}</span>
          </div>
        </div>
      )}

      {!loading && !error && tiers.length > 0 && (
        <div className="position-absolute top-0 start-0 m-2 px-2 py-1 rounded small shadow-sm" style={{ background: 'rgba(11,21,48,0.75)', color: '#fff', pointerEvents: 'none' }}>
          <span style={{ color: '#2ee66b' }}>●</span> Online &nbsp; <span style={{ color: '#ff3b3b' }}>●</span> Offline
          {tiers.some((t) => t.online + t.offline > DOT_CAP) && (
            <div style={{ fontSize: '10.5px', opacity: 0.8 }}>Tầng trên {DOT_CAP} máy: mỗi đốm đại diện nhiều máy</div>
          )}
        </div>
      )}

      <div className="position-absolute bottom-0 start-0 m-2 px-2 py-1 bg-white text-dark border rounded small shadow-sm">
        <i className="bi bi-compass-fill text-primary me-1"></i> <strong>Kéo chuột:</strong> Xoay | <strong>Rê chuột:</strong> Xem số lượng máy | <strong>Click:</strong> Chọn tầng
      </div>
    </div>
  );
};
