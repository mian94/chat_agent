import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { apiRouter } from './routes';
import { handleChatSSE } from './chat-handler';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Express 中间件和路由（用于非 SSE 接口）
app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  console.log(`[Server] ${req.method} ${req.url}, Content-Length: ${req.headers['content-length']}`);
  // SSE 聊天接口：直接用原生方式处理
  if (req.method === 'POST' && req.url === '/api/chat') {
    // 收集请求体
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      // 设置 CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      // 调用 SSE 处理器
      handleChatSSE(req, res, body);
    });
    return;
  }

  // OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // 其他请求交给 Express
  app(req, res);
});

server.listen(PORT, () => {
  console.log(`✅ 后端服务已启动: http://localhost:${PORT}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/api/health`);
});

export default app;
