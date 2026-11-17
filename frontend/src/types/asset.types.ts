export interface Asset {
  id: number;
  node_id: number | null;
  it_asset_code: string;
  hostname: string | null;
  category: string;
  product: string;
  production_line: string;
  finance_asset_code: string;
  po_invoice: string;
  serial_number: string;
  mac_address: string;
  /** Chỉ do hệ thống kiểm tra mạng quyết định (không sửa tay) */
  status: 'online' | 'offline';
  last_seen_at: string | null;
  /** Đang tắt cảnh báo offline tới thời điểm này (máy mới / đang bảo trì). Tự hết khi máy online lại */
  alerts_muted_until?: string | null;
  // Người dùng
  assigned_to?: string | null;
  staff_code?: string | null;
  mail_user?: string | null;
  department?: string | null;
  // Monitor gắn vào PC nào
  parent_asset_id?: number | null;
}

export interface AssetMeta {
  lines: string[];
  departments: string[];
  categories: string[];
}

export interface TreeNode {
  id: number;
  parent_id: number | null;
  name: string;
  code: string;
  node_type: 'company' | 'plant' | 'workshop' | 'line' | 'zone';
  description: string;
}
