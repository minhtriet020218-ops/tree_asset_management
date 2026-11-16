import { apiClient } from './apiClient';
import type { Asset } from '../types/asset.types';

export const assetService = {
  getAssets: async (nodeId?: number, status?: string): Promise<Asset[]> => {
    const response = await apiClient.get<{ success: boolean; data: Asset[] }>('/assets', {
      params: { node_id: nodeId, status },
    });
    return response.data.data;
  },

  createAsset: async (assetData: Partial<Asset>): Promise<Asset> => {
    const response = await apiClient.post<{ success: boolean; data: Asset }>('/assets', assetData);
    return response.data.data;
  },

  updateAsset: async (id: number, assetData: Partial<Asset>): Promise<Asset> => {
    const response = await apiClient.put<{ success: boolean; data: Asset }>(`/assets/${id}`, assetData);
    return response.data.data;
  },

  deleteAsset: async (id: number): Promise<void> => {
    await apiClient.delete(`/assets/${id}`);
  },

  getDashboardStats: async () => {
    const response = await apiClient.get('/assets/dashboard/stats');
    return response.data.data;
  },
};