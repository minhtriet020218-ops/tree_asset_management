export interface Asset {
  id: number;
  node_id: number;
  it_asset_code: string;
  hostname: string;
  category: string;
  product: string;
  production_line: string;
  finance_asset_code: string;
  po_invoice: string;
  serial_number: string;
  mac_address: string; // <-- Đã thêm lại MAC Address
  status: 'online' | 'offline' | 'maintenance';
  last_seen_at: string;
}

export interface TreeNode {
  id: number;
  parent_id: number | null;
  name: string;
  code: string;
  node_type: 'company' | 'plant' | 'workshop' | 'line' | 'zone';
  description: string;
}