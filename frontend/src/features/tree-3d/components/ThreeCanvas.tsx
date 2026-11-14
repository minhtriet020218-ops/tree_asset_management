import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const ThreeCanvas: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d20); // Dark theme công nghiệp

    const camera = new THREE.PerspectiveCamera(
      60,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 3. Grid Helper (Sàn nhà máy)
    const gridHelper = new THREE.GridHelper(20, 20, 0x0d6efd, 0x495057);
    scene.add(gridHelper);

    // 4. Tạo cụm thiết bị 3D mô phỏng dây chuyền (Assets)
    const assetsGroup = new THREE.Group();
    const geom = new THREE.BoxGeometry(1.2, 1.5, 1.2);
    
    const assetMeshes: THREE.Mesh[] = [];
    const positions = [
      { x: -3, z: -2, name: 'CNC Machine 01' },
      { x: 0, z: -2, name: 'Robot Arm 02' },
      { x: 3, z: -2, name: 'Conveyor Line 03' },
      { x: -1.5, z: 1, name: 'Server Rack 04' },
      { x: 1.5, z: 1, name: 'Power Generator 05' },
    ];

    positions.forEach((pos, idx) => {
      const mat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? 0x0d6efd : 0x198754,
        roughness: 0.2,
        metalness: 0.3,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(pos.x, 0.75, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Gắn metadata để nhận diện khi click
      mesh.userData = { name: pos.name };
      
      assetsGroup.add(mesh);
      assetMeshes.push(mesh);
    });

    scene.add(assetsGroup);

    // 5. Raycaster xử lý sự kiện Click chuột vào 3D Object
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(assetMeshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const assetName = hitMesh.userData.name;
        setSelectedAsset(assetName);

        // Hiệu ứng đổi màu tạm thời khi click chọn
        assetMeshes.forEach((m) => (m.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000));
        (hitMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xffaa00);
      }
    };

    renderer.domElement.addEventListener('click', onClick);

    // 6. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      assetsGroup.rotation.y += 0.002; // Xoay nhẹ tổng thể không gian
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
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
      renderer.domElement.removeEventListener('click', onClick);
      if (currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="position-relative">
      <div ref={mountRef} style={{ width: '100%', height: '520px', borderRadius: '6px', overflow: 'hidden' }} />
      {selectedAsset && (
        <div className="position-absolute bottom-0 start-0 m-3 p-2 bg-dark text-white rounded shadow bg-opacity-75 small">
          <i className="bi bi-info-circle text-warning me-1"></i> Đang chọn thiết bị: <strong>{selectedAsset}</strong>
        </div>
      )}
    </div>
  );
};