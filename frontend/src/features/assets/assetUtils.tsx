import type { Asset } from '../../types/asset.types';

const cat = (a: Asset) => (a.category || '').toLowerCase();

export const isMonitor = (a: Asset) => cat(a).includes('monitor') || cat(a).includes('màn hình');
export const isPrinter = (a: Asset) => cat(a).includes('printer') || cat(a).includes('máy in');