// Phần tính toán thuần (không phụ thuộc Three.js) cho đồ trang trí trên cây thông:
// số đốm, vị trí rải đều trên mặt nón, màu đốm. Tách riêng để kiểm thử được.

/** Số đốm tối đa mỗi tầng. Tầng đông máy hơn thì mỗi đốm đại diện nhiều máy (giữ đúng tỉ lệ xanh/đỏ). */
export const DOT_CAP = 220;

export interface DotCounts {
  green: number;
  red: number;
  /** Mỗi đốm đại diện bao nhiêu máy (1 = mỗi máy một đốm) */
  perDot: number;
}

export function dotCounts(online: number, offline: number, cap: number = DOT_CAP): DotCounts {
  const on = Math.max(0, Math.floor(online));
  const off = Math.max(0, Math.floor(offline));
  const total = on + off;
  if (total === 0) return { green: 0, red: 0, perDot: 1 };
  if (total <= cap) return { green: on, red: off, perDot: 1 };
  let red = Math.round((off / total) * cap);
  let green = cap - red;
  // Còn máy offline thì luôn có ít nhất 1 đốm đỏ (và ngược lại), để không bị "mất" tình trạng
  if (off > 0 && red === 0) {
    red = 1;
    green = cap - 1;
  }
  if (on > 0 && green === 0) {
    green = 1;
    red = cap - 1;
  }
  return { green, red, perDot: total / cap };
}

/** Bộ sinh số ngẫu nhiên có hạt giống (cùng hạt giống -> cùng kết quả) */
export function seededRandom(seed: number): () => number {
  let a = (seed >>> 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chọn ngẫu nhiên (ổn định theo seed) `redCount` trong `n` vị trí để tô đỏ -> đốm đỏ nằm rải rác, không dồn cục. */
export function redMask(n: number, redCount: number, seed: number): boolean[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  const rnd = seededRandom(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const mask: boolean[] = new Array(n).fill(false);
  for (let k = 0; k < Math.min(redCount, n); k++) mask[idx[k]] = true;
  return mask;
}

export interface Dot {
  x: number;
  y: number;
  z: number;
  /** Pháp tuyến hướng ra ngoài mặt nón (đã chuẩn hóa) */
  nx: number;
  ny: number;
  nz: number;
}

/**
 * Rải `n` điểm đều theo DIỆN TÍCH trên mặt xung quanh của hình nón (kiểu hoa hướng dương: góc vàng).
 * Nón có đáy ở y = centerY - height/2, đỉnh ở y = centerY + height/2.
 * tMin/tMax (0..1) = đoạn từ đáy lên đỉnh được phép đặt điểm (tránh sát đỉnh nơi bị tầng trên che).
 */
export function coneDots(n: number, radius: number, height: number, centerY: number, tMin: number, tMax: number, phase = 0): Dot[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const a = (1 - tMin) ** 2;
  const b = (1 - tMax) ** 2;
  const slant = Math.hypot(radius, height);
  const dots: Dot[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const t = 1 - Math.sqrt(a - u * (a - b));
    const r = radius * (1 - t);
    const theta = i * golden + phase;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    dots.push({
      x: r * c,
      y: centerY - height / 2 + t * height,
      z: r * s,
      nx: (height * c) / slant,
      ny: radius / slant,
      nz: (height * s) / slant,
    });
  }
  return dots;
}

/** Bán kính đốm theo mật độ: ít máy -> đốm to rõ, nhiều máy -> đốm nhỏ lại cho khỏi chồng nhau */
export function dotRadius(n: number, radius: number, height: number, tMin: number, tMax: number): number {
  if (n <= 0) return 0;
  const slant = Math.hypot(radius, height);
  const area = Math.PI * radius * slant * ((1 - tMin) ** 2 - (1 - tMax) ** 2);
  const spacing = Math.sqrt(area / n);
  return Math.min(0.11, Math.max(0.035, spacing * 0.3));
}
