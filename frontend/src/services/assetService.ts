import { apiClient } from './apiClient';
import type { Asset, AssetMeta } from '../types/asset.types';

export const assetService = {
  getAssets: async (nodeId?: number, status?: string, search?: string): Promise<Asset[]> => {
    const response = await apiClient.get<{ success: boolean; data: Asset[] }>('/assets', {
      params: { node_id: nodeId, status, search },
    });
    return response.data.data;
  },

  getMeta: async (): Promise<AssetMeta> => {
    const response = await apiClient.get<{ success: boolean; data: AssetMeta }>('/assets/meta');
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

  getDashboardStats: async (): Promise<{ total: number; online: number; offline: number; maintenance: number }> => {
    const response = await apiClient.get('/assets/dashboard/stats');
    return response.data.data;
  },
};