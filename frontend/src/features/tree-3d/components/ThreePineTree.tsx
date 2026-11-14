import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TreeNode } from '../../../types/asset.types';

interface ThreePineTreeProps {
  onSelectTier: (node: TreeNode) => void;
}

export const ThreePineTree: React.FC<ThreePineTreeProps> = ({ onSelectTier }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa); 

    const camera = new THREE.PerspectiveCamera(50, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);

    // 2. Orbit Controls (Giới hạn góc lên xuống 90 độ)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 15;

    // Giới hạn góc ngẩng (Polar Angle) từ 0 (đỉnh) đến 90 độ (ngang mặt đất)
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2;

    // 3. Hệ thống ánh sáng
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 15, 10);
    scene.add(dirLight);

    const treeGroup = new THREE.Group();

    // 4. Thảm cỏ xanh nhạt mỏng & rộng bên dưới
    const grassGeo = new THREE.CylinderGeometry(4.8, 5.2, 0.08, 64);
    const grassMat = new THREE.MeshStandardMaterial({ 
      color: 0x8ce99a, 
      roughness: 0.8,
      metalness: 0.1 
    }); 
    const grassPlatform = new THREE.Mesh(grassGeo, grassMat);
    grassPlatform.position.set(0, -2.15, 0);
    treeGroup.add(grassPlatform);

    // 5. Thân gốc cao
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1.6, 32),
      new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.4 })
    );
    trunk.position.set(0, -1.3, 0);
    treeGroup.add(trunk);

    // 6. Các tầng cây thông
    const createTierMaterial = () => new THREE.MeshStandardMaterial({
      color: 0x20c997,
      roughness: 0.2,
      metalness: 0.1,
      emissive: 0x000000,
      emissiveIntensity: 0
    });

    const tier1 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.4, 32), createTierMaterial());
    tier1.position.set(0, 1.9, 0);
    tier1.userData = { node: { id: 1, name: 'Tầng 1: Đỉnh / Khu vực Quản lý Cấp cao', node_type: 'plant' } };
    treeGroup.add(tier1);

    const tier2 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.5, 32), createTierMaterial());
    tier2.position.set(0, 0.6, 0);
    tier2.userData = { node: { id: 2, name: 'Tầng 2: Phân xưởng Gia công', node_type: 'workshop' } };
    treeGroup.add(tier2);

    const tier3 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 32), createTierMaterial());
    tier3.position.set(0, -0.7, 0);
    tier3.userData = { node: { id: 3, name: 'Tầng 3: Khu vực Lắp ráp & Dây chuyền', node_type: 'line' } };
    treeGroup.add(tier3);

    // Ngôi sao vàng đỉnh
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({ color: 0xffc107, emissive: 0xffc107, emissiveIntensity: 0.8 })
    );
    star.position.set(0, 2.8, 0);
    treeGroup.add(star);

    scene.add(treeGroup);

    const interactiveObjects = [tier1, tier2, tier3];

    // 7. Raycaster xử lý Hover và Click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh: THREE.Mesh | null = null;

    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjects);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        if (hoveredMesh !== hitMesh) {
          if (hoveredMesh) {
            (hoveredMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
            (hoveredMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
          }
          hoveredMesh = hitMesh;
          (hoveredMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xff9900);
          (hoveredMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
          document.body.style.cursor = 'pointer';
        }
      } else {
        if (hoveredMesh) {
          (hoveredMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          (hoveredMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
          hoveredMesh = null;
          document.body.style.cursor = 'default';
        }
      }
    };

    const onClick = () => {
      if (hoveredMesh) {
        const selectedNode = hoveredMesh.userData.node as TreeNode;
        hoveredMesh.scale.set(1.12, 1.12, 1.12);
        setTimeout(() => hoveredMesh?.scale.set(1, 1, 1), 200);

        onSelectTier(selectedNode);
      }
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    // 8. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      document.body.style.cursor = 'default';
      if (currentMount) currentMount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="position-relative">
      <div ref={mountRef} style={{ width: '100%', height: '450px', borderRadius: '6px', overflow: 'hidden' }} />
      <div className="position-absolute bottom-0 start-0 m-2 px-2.5 py-1 bg-white text-dark border rounded small shadow-sm">
        <i className="bi bi-compass-fill text-primary me-1"></i> <strong>Góc xoay:</strong> Giới hạn 90 độ lên xuống | <strong>Rê chuột:</strong> Sáng vàng | <strong>Click:</strong> Chọn tầng
      </div>
    </div>
  );
};