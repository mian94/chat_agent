import { Router, Request, Response } from 'express';
import type { ApiResponse, HealthCheckResponse } from '../types';

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

/** 预留：聊天接口 */
apiRouter.post('/chat', (_req: Request, res: Response) => {
  const data: ApiResponse = {
    success: true,
    message: '聊天接口 — 待实现',
  };
  res.json(data);
});
