import { apiClient } from './apiClient';
import type { MaintenanceInput, MaintenanceLog } from '../types/maintenance.types';

export const maintenanceService = {
  list: async (assetId: number): Promise<MaintenanceLog[]> => {
    const res = await apiClient.get<{ success: boolean; data: MaintenanceLog[] }>(`/assets/${assetId}/maintenance`);
    return res.data.data;
  },

  create: async (assetId: number, input: MaintenanceInput): Promise<MaintenanceLog> => {
    const res = await apiClient.post<{ success: boolean; data: MaintenanceLog }>(
      `/assets/${assetId}/maintenance`,
      input,
    );
    return res.data.data;
  },

  remove: async (assetId: number, logId: number): Promise<void> => {
    await apiClient.delete(`/assets/${assetId}/maintenance/${logId}`);
  },
};