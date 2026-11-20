import type { Asset } from '../../types/asset.types';

const cat = (a: Asset) => (a.category || '').toLowerCase();

export const isMonitor = (a: Asset) => cat(a).includes('monitor') || cat(a).includes('màn hình');
export const isPrinter = (a: Asset) => cat(a).includes('printer') || cat(a).includes('máy in');

// Đang tắt cảnh báo offline (máy mới tạo / đang bảo trì)
export const isMuted = (a: Asset) =>
  !!a.alerts_muted_until && new Date(a.alerts_muted_until).getTime() > Date.now();

const text = (a: Asset) => `${a.category || ''} ${a.product || ''}`;

// "Monitor show up": tấm hiển thị dọc đặt ở đầu line. Nhận diện qua Category/Product có chữ show / andon / signage / bảng
export const isShowMonitor = (a: Asset) => isMonitor(a) && /show|andon|signage|bảng/i.test(text(a));

// PC "to" (hình chữ nhật đứng). Các PC còn lại vẽ hình vuông nhỏ kiểu HP ProDesk G3.
// Nhận diện qua Category/Product có chữ tower / workstation / MT / precision / thinkstation / Z2-Z8
export const isTowerPc = (a: Asset) => /\b(tower|workstation|mt|precision|thinkstation|z[2468])\b/i.test(text(a));

// Thiết bị đang trong KHO (chưa biên chế vào line): thiếu node hoặc thiếu Line.
// Ưu tiên cờ in_stock do server tính; chưa có (vd: vừa tạo xong) thì tự suy ra bằng đúng quy tắc đó.
export const isStock = (a: Asset) => a.in_stock ?? (a.node_id == null || !(a.production_line ?? '').trim());
