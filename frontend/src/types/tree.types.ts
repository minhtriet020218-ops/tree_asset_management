import type { TreeNode } from './asset.types';

// Node kèm thống kê (đã gộp cả các node con), không tính Monitor
export interface TreeNodeStats extends TreeNode {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
}