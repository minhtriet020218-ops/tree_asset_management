import * as THREE from 'three';

/**
 * Điều khiển camera góc nhìn thứ nhất: camera đứng yên tại chỗ và quay đầu nhìn quanh (không xoay quanh tâm cảnh như OrbitControls).
 *  - Kéo chuột trái: nhìn quanh (kéo sang phải = quay đầu sang phải, kéo lên = ngẩng lên).
 *  - Con lăn: tiến / lùi theo hướng đang nhìn.
 *  - Kéo chuột phải hoặc chuột giữa: trượt ngang / lên xuống.
 * `target` luôn là điểm phía trước camera; phím WASD, bay tới góc nhìn có sẵn và zoom vào line dùng nó để biết hướng nhìn.
 */
export class FirstPersonControls {
  enabled = true;
  /** Điểm đang nhìn tới (cách camera `lookDistance` khi vừa quay đầu) */
  readonly target = new THREE.Vector3(0, 0, -10);
  /** Tỉ lệ kích thước cảnh: quyết định bước tiến / lùi, tốc độ trượt, tốc độ phím */
  scale = 3;
  /** Độ nhạy quay đầu (radian trên mỗi pixel) */
  sensitivity = 0.0035;
  private readonly lookDistance = 10;
  private yaw = 0;
  private pitch = 0;
  private mode: 'look' | 'pan' | null = null;
  private lastX = 0;
  private lastY = 0;
  private starts: Array<() => void> = [];
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  private readonly camera: THREE.PerspectiveCamera;
  private readonly dom: HTMLElement;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    camera.rotation.order = 'YXZ';
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    dom.addEventListener('contextmenu', this.onContext);
  }

  /** Gọi mỗi khi người dùng bắt đầu tự điều khiển (để dừng chuyến bay tự động) */
  onStart(fn: () => void): void {
    this.starts.push(fn);
  }

  /** Quay đầu nhìn về điểm t mà không đổi vị trí camera */
  lookAt(t: THREE.Vector3): void {
    this.target.copy(t);
    const d = this.fwd.subVectors(t, this.camera.position);
    const len = d.length();
    if (len < 1e-6) return;
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.asin(THREE.MathUtils.clamp(d.y / len, -1, 1));
    this.apply();
  }

  /** Dời camera và điểm nhìn cùng một đoạn (đi / trượt mà không đổi hướng nhìn) */
  translate(v: THREE.Vector3): void {
    this.camera.position.add(v);
    this.target.add(v);
  }

  update(): void {}

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onDown);
    this.dom.removeEventListener('wheel', this.onWheel);
    this.dom.removeEventListener('contextmenu', this.onContext);
    this.stop();
  }

  private apply(): void {
    const limit = Math.PI / 2 - 0.01;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -limit, limit);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Hướng nhìn hiện tại (vector đơn vị) */
  private forward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 0, -1).applyEuler(this.camera.rotation);
  }

  private readonly onContext = (e: Event) => e.preventDefault();

  private readonly onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (e.button === 0) this.mode = 'look';
    else if (e.button === 1 || e.button === 2) this.mode = 'pan';
    else return;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.starts.forEach((fn) => fn());
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  };

  private readonly onMove = (e: PointerEvent) => {
    if (!this.mode) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (this.mode === 'look') {
      this.yaw -= dx * this.sensitivity;
      this.pitch -= dy * this.sensitivity;
      this.apply();
      this.target.copy(this.camera.position).addScaledVector(this.forward(this.fwd), this.lookDistance);
    } else {
      const k = this.scale * 0.004;
      this.right.set(1, 0, 0).applyEuler(this.camera.rotation);
      const up = this.fwd.set(0, 1, 0).applyEuler(this.camera.rotation);
      this.translate(this.right.multiplyScalar(-dx * k).addScaledVector(up, dy * k));
    }
  };

  private readonly onUp = () => this.stop();

  private stop(): void {
    this.mode = null;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  private readonly onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this.starts.forEach((fn) => fn());
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const step = -delta * 0.01 * this.scale * 0.4;
    this.translate(this.forward(this.fwd).multiplyScalar(step));
  };
}
