export interface Asset {
  id: number;
  node_id: number;
  serial_number: string;
  mac_address: string;
  hostname: string;
  status: 'online' | 'offline' | 'maintenance';
  line_name: string;
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