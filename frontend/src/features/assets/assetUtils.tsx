import type { Asset } from '../../types/asset.types';

const cat = (a: Asset) => (a.category || '').toLowerCase();

export const isMonitor = (a: Asset) => cat(a).includes('monitor') || cat(a).includes('màn hình');
export const isPrinter = (a: Asset) => cat(a).includes('printer') || cat(a).includes('máy in');

// Đang tắt cảnh báo offline (máy mới tạo / đang bảo trì)
export const isMuted = (a: Asset) =>
  !!a.alerts_muted_until && new Date(a.alerts_muted_until).getTime() > Date.now();
