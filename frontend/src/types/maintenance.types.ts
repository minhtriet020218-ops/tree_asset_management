export const MAINTENANCE_TYPES = [
  { value: 'repair', label: 'Sửa chữa' },
  { value: 'upgrade', label: 'Nâng cấp' },
  { value: 'replacement', label: 'Thay linh kiện' },
  { value: 'inspection', label: 'Kiểm tra / bảo dưỡng định kỳ' },
  { value: 'cleaning', label: 'Vệ sinh' },
  { value: 'other', label: 'Khác' },
] as const;

export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number]['value'];

export interface MaintenanceLog {
  id: number;
  asset_id: number;
  type: MaintenanceType;
  description: string;
  performed_by: string | null;
  performed_at: string;
  created_at: string;
}

export interface MaintenanceInput {
  type: MaintenanceType;
  description: string;
  performed_by?: string;
  performed_at?: string; // ISO
  /** Tắt cảnh báo offline của thiết bị trong N giờ (không đổi online/offline thật; tự hết khi máy online lại) */
  mute_hours?: number;
}
