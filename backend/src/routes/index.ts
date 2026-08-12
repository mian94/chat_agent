import { Router, Request, Response } from 'express';
import type { ApiResponse, HealthCheckResponse } from '../types';
import { getAvailableTools } from '../tools';

export const apiRouter = Router();

/** 健康检查接口 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  const data: ApiResponse<HealthCheckResponse> = {
    success: true,
    message: '服务运行正常',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
  res.json(data);
});

/** 获取可用工具列表 */
apiRouter.get('/tools', (_req: Request, res: Response) => {
  const tools = getAvailableTools();
  const data: ApiResponse<string[]> = {
    success: true,
    data: tools,
  };
  res.json(data);
});
