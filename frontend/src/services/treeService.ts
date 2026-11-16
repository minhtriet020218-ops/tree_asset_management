import { apiClient } from './apiClient';
import type { TreeNode } from '../types/asset.types';
import type { TreeNodeStats } from '../types/tree.types';

export const treeService = {
  getNodes: async (): Promise<TreeNode[]> => {
    const res = await apiClient.get<{ success: boolean; data: TreeNode[] }>('/tree');
    return res.data.data;
  },

  getStats: async (): Promise<TreeNodeStats[]> => {
    const res = await apiClient.get<{ success: boolean; data: TreeNodeStats[] }>('/tree/stats');
    return res.data.data;
  },
};