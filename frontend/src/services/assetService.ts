import axios from 'axios';
import { apiClient } from './apiClient';
import type { Asset, AssetMeta } from '../types/asset.types';

export interface ExportAssetsParams {
  nodeId?: number;
  status?: Asset['status'];
  search?: string;
  /** false = chỉ lấy đúng node này, không gồm node con (mặc định: gồm node con) */
  includeChildren?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function fallbackFilename(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `Asset_Report_${date}_${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`;
}

// Lấy tên file từ header Content-Disposition (cần backend cho phép CORS expose header này)
function filenameFromHeader(value: unknown): string | null {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(value ?? ''));
  return match ? decodeURIComponent(match[1]) : null;
}

// Kích hoạt tải file ở trình duyệt từ một Blob
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Với responseType 'blob', lỗi JSON của server (400/500) cũng nằm trong Blob nên phải đọc ra
async function readExportError(error: unknown): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const body = JSON.parse(await error.response.data.text());
      if (typeof body?.message === 'string') return body.message;
    } catch {
      /* không phải JSON: dùng thông báo chung bên dưới */
    }
  }
  return 'Không xuất được file Excel. Vui lòng thử lại.';
}

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

  /** Tải file Excel danh sách tài sản (theo bộ lọc nếu có). Ném Error với message tiếng Việt nếu thất bại. */
  exportAssets: async (params: ExportAssetsParams = {}): Promise<void> => {
    try {
      const response = await apiClient.get<Blob>('/reports/export', {
        params: {
          node_id: params.nodeId,
          status: params.status,
          search: params.search || undefined,
          include_children: params.includeChildren === false ? 'false' : undefined,
        },
        responseType: 'blob',
        timeout: 120000, // xuất nhiều máy có thể lâu hơn mức 15s mặc định
      });
      const filename = filenameFromHeader(response.headers['content-disposition']) ?? fallbackFilename();
      saveBlob(response.data, filename);
    } catch (error) {
      throw new Error(await readExportError(error));
    }
  },
};