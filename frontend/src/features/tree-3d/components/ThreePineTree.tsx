import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TreeNode } from '../../../types/asset.types';
import type { TreeNodeStats } from '../../../types/tree.types';
import { treeService } from '../../../services/treeService';

interface ThreePineTreeProps {
  onSelectTier: (node: TreeNode) => void;
}

const MAX_TIERS = 6;
const REFRESH_MS = 30000;

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
    scene.background = new THREE.Color(0xf8f9fa);

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 15, 10);
    scene.add(dirLight);

    const treeGroup = new THREE.Group();

    const grass = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 5.2, 0.08, 64),
      new THREE.MeshStandardMaterial({ color: 0x8ce99a, roughness: 0.8 }),
    );
    grass.position.set(0, -2.15, 0);
    treeGroup.add(grass);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1.6, 32),
      new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.4 }),
    );
    trunk.position.set(0, -1.3, 0);
    treeGroup.add(trunk);

    // Các tầng: số tầng tuỳ dữ liệu, tầng đầu tiên ở dưới cùng
    const count = tierList.length;
    const step = 3.9 / Math.max(count, 3);
    const meshes: THREE.Mesh[] = [];
    meshesRef.current = new Map();

    tierList.forEach((tier, i) => {
      const radius = count === 1 ? 2.4 : 2.4 - 1.2 * (i / (count - 1));
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(radius, step * 1.15, 32),
        new THREE.MeshStandardMaterial({
          color: tierColor(nodesRef.current.get(tier.id)),
          roughness: 0.2,
          metalness: 0.1,
        }),
      );
      mesh.position.set(0, -0.7 + i * step, 0);
      mesh.userData = { nodeId: tier.id };
      treeGroup.add(mesh);
      meshes.push(mesh);
      meshesRef.current.set(tier.id, mesh);
    });

    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({ color: 0xffc107, emissive: 0xffc107, emissiveIntensity: 0.8 }),
    );
    star.position.set(0, -0.7 + (count - 1) * step + step * 0.7 + 0.2, 0);
    treeGroup.add(star);
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
    const animate = () => {
      frameId = requestAnimationFrame(animate);
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
      treeGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      meshesRef.current = new Map();
    };
  }, [tierKey]);

  // --- Số liệu mới về thì chỉ đổi màu tầng, không dựng lại scene ---
  useEffect(() => {
    meshesRef.current.forEach((mesh, id) => {
      (mesh.material as THREE.MeshStandardMaterial).color.setHex(tierColor(nodesRef.current.get(id)));
    });
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

      <div className="position-absolute bottom-0 start-0 m-2 px-2 py-1 bg-white text-dark border rounded small shadow-sm">
        <i className="bi bi-compass-fill text-primary me-1"></i> <strong>Kéo chuột:</strong> Xoay | <strong>Rê chuột:</strong> Xem số lượng máy | <strong>Click:</strong> Chọn tầng
      </div>
    </div>
  );
};
