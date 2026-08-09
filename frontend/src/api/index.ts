import request from './request';
import type { ApiResponse, HealthCheckResponse } from '@/types';

/** 健康检查 */
export async function checkHealth(): Promise<ApiResponse<HealthCheckResponse>> {
  const res = await request.get<ApiResponse<HealthCheckResponse>>('/api/health');
  return res.data;
}
