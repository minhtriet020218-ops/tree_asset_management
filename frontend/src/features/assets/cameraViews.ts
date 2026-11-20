/** Góc nhìn có sẵn của camera + tính khoảng cách để thấy trọn 1 vùng. Chỉ dùng số thuần (không phụ thuộc three) cho dễ kiểm thử. */
export type ViewName = 'iso' | 'top' | 'front' | 'left' | 'right';
export type Vec3 = [number, number, number];
export interface Pose {
  pos: Vec3;
  target: Vec3;
}

/** Khoảng cách camera để vùng rộng w x cao h lọt trọn khung hình (fov dọc, tỉ lệ khung aspect) */
export function fitDistance(w: number, h: number, fovDeg: number, aspect: number, margin = 1.12): number {
  const t = Math.tan((fovDeg * Math.PI) / 360);
  return Math.max(h / 2 / t, w / 2 / (t * Math.max(aspect, 0.1))) * margin;
}

/** Tư thế camera cho 1 góc nhìn có sẵn, nhìn vào hộp [min, max] */
export function viewPose(name: ViewName, min: Vec3, max: Vec3, fovDeg: number, aspect: number): Pose {
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const c: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  if (name === 'iso') {
    // góc chéo mặc định: nhìn từ phía trước, hơi lệch phải, từ trên xuống
    const r = Math.max(size[0], size[2] * 1.4, size[1]) * 0.9;
    return { target: c, pos: [c[0] + r * 0.35, c[1] + r * 0.85, c[2] + r * 1.05] };
  }
  const spec: Record<Exclude<ViewName, 'iso'>, { dir: Vec3; w: number; h: number; depth: number }> = {
    top: { dir: [0, 1, 0.001], w: size[0], h: size[2], depth: size[1] },
    front: { dir: [0, 0.18, 1], w: size[0], h: size[1], depth: size[2] },
    left: { dir: [-1, 0.18, 0], w: size[2], h: size[1], depth: size[0] },
    right: { dir: [1, 0.18, 0], w: size[2], h: size[1], depth: size[0] },
  };
  const s = spec[name];
  const dist = fitDistance(s.w, s.h, fovDeg, aspect) + s.depth / 2;
  const len = Math.hypot(...s.dir);
  return { target: c, pos: [c[0] + (s.dir[0] / len) * dist, c[1] + (s.dir[1] / len) * dist, c[2] + (s.dir[2] / len) * dist] };
}

/** Tư thế để zoom vào 1 vùng (vd 1 khung line), giữ nguyên hướng nhìn hiện tại */
export function focusPose(min: Vec3, max: Vec3, camPos: Vec3, camTarget: Vec3, fovDeg: number, aspect: number): Pose {
  const c: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const dir: Vec3 = [camPos[0] - camTarget[0], camPos[1] - camTarget[1], camPos[2] - camTarget[2]];
  const len = Math.hypot(...dir) || 1;
  const w = Math.max(max[0] - min[0], max[2] - min[2]);
  const h = max[1] - min[1];
  const dist = fitDistance(w, h, fovDeg, aspect, 1.3);
  return { target: c, pos: [c[0] + (dir[0] / len) * dist, c[1] + (dir[1] / len) * dist, c[2] + (dir[2] / len) * dist] };
}
