# 开发 Bug 记录

本文档记录前端面试辅导 Agent 项目开发过程中遇到的 Bug、原因分析、解决方案，以及面试中可能被问到的相关问题。

---

## Bug #1：前端请求 404 错误

### 现象
前端发送聊天消息时，收到 `❌ Request failed with status code 404` 错误。

### 原因分析
前端 API 路径配置错误，导致请求路径重复：

```typescript
// 前端 api/index.ts
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';  // baseURL = '/api'
const response = await fetch(`${baseURL}/api/chat`, {...});    // 实际路径 = '/api/api/chat'
```

请求路径变成了 `/api/api/chat`，而后端路由只处理 `/api/chat`，导致 404。

### 解决方案
修改前端 API 路径，去掉重复的 `/api`：

```typescript
// 修改后
const response = await fetch(`${baseURL}/chat`, {...});  // 实际路径 = '/api/chat'
```

### 面试问题

**Q：你在项目中遇到过哪些典型的 Bug？**

**A：** 我遇到过一个前后端接口路径不匹配的 Bug。前端请求路径配置为 `/api/api/chat`，实际应该是 `/api/chat`。原因是 `baseURL` 已经包含了 `/api` 前缀，但拼接路径时又加了一次。

这个问题的排查过程是：
1. 先检查后端路由配置，确认接口存在
2. 再检查前端请求路径，发现路径重复
3. 通过浏览器 Network 面板确认实际请求 URL

**Q：如何避免这类接口路径问题？**

**A：** 
1. **统一管理 API 路径**：创建 API 配置文件，集中管理所有接口路径
2. **使用环境变量**：通过 `.env` 文件配置 `baseURL`，避免硬编码
3. **TypeScript 类型检查**：定义接口类型，编译时检查参数
4. **接口文档**：使用 Swagger/OpenAPI 自动生成接口文档

---

## Bug #2：Node.js 25 中 SSE 流式输出失效

### 现象
后端使用 `res.write()` 发送 SSE 数据，客户端收不到任何数据。服务器日志显示数据已成功发送，但客户端响应为空。

### 原因分析
在 **Express 5 + Node.js 25** 环境中，从 `https.request` 的异步回调中调用 `res.write()` 发送 SSE 数据时，即使 `write` 返回 `true`，客户端也无法收到数据。

```typescript
// 问题代码
const apiReq = https.request(options, (apiRes) => {
  apiRes.on('data', (chunk) => {
    // ❌ 这里 res.write() 不会立即刷新到客户端
    res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`);
  });
});
```

**根本原因**：Node.js 25 的 HTTP 响应刷新机制发生了变化，`res.write()` 在某些异步上下文中不会立即刷新到客户端。

### 解决方案
使用原生 `http.createServer()` 处理 SSE 请求，绕过 Express 的兼容性问题：

```typescript
// 解决方案：使用原生 HTTP 服务器
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      handleChatSSE(req, res, body);
    });
    return;
  }
  // 其他请求交给 Express
  app(req, res);
});
```

```typescript
// SSE 处理器：直接发送所有数据
export function handleChatSSE(req, res, body) {
  // ... 解析 DeepSeek API 响应 ...
  
  // ✅ 直接发送所有数据，不用 setTimeout 分块
  for (let i = 0; i < deltas.length; i++) {
    res.write(`data: ${JSON.stringify({ type: 'delta', content: deltas[i] })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}
```

### 面试问题

**Q：什么是 SSE？和 WebSocket 有什么区别？**

**A：** SSE（Server-Sent Events）是一种服务器向客户端推送数据的技术，基于 HTTP 协议。

| 特性 | SSE | WebSocket |
|------|-----|-----------|
| 协议 | HTTP | 独立协议（ws://） |
| 方向 | 单向（服务器→客户端） | 双向 |
| 数据格式 | 文本 | 文本/二进制 |
| 浏览器支持 | 所有现代浏览器 | 所有现代浏览器 |
| 适用场景 | 通知、实时数据流、AI 对话 | 聊天、游戏、协同编辑 |

SSE 适合 AI 对话场景，因为：
1. 只需要服务器向客户端推送
2. 基于 HTTP，兼容性好
3. 自动重连机制

**Q：你在项目中如何实现 SSE 流式输出？遇到过什么问题？**

**A：** 我使用 Express + DeepSeek API 实现 SSE 流式输出。遇到的主要问题是 Node.js 25 中 `res.write()` 在异步回调中不刷新。

解决方案是使用原生 `http.createServer()` 处理 SSE 请求，绕过 Express 的兼容性问题。同时，直接发送所有数据而不是用 `setTimeout` 分块发送，确保数据立即刷新到客户端。

**Q：为什么选择 SSE 而不是 WebSocket？**

**A：** 
1. **需求匹配**：AI 对话只需要服务器向客户端推送，不需要双向通信
2. **实现简单**：基于 HTTP，不需要额外的协议升级
3. **兼容性好**：所有现代浏览器都支持
4. **自动重连**：SSE 内置重连机制，WebSocket 需要手动实现

---

## Bug #3：Node.js 版本兼容性问题

### 现象
项目在 Node.js 18/20 上运行正常，升级到 Node.js 25 后出现各种问题。

### 原因分析
Node.js 25 是最新版本，引入了一些 breaking changes：
1. HTTP 响应刷新机制变化
2. 某些 API 行为调整
3. 性能优化导致的副作用

### 解决方案
1. **锁定 Node.js 版本**：在 `package.json` 中指定 Node.js 版本
2. **使用 LTS 版本**：生产环境使用 Node.js 20 LTS
3. **版本管理工具**：使用 `nvm` 或 `fnm` 管理多个 Node.js 版本

```json
// package.json
{
  "engines": {
    "node": ">=18.0.0 <26.0.0"
  }
}
```

### 面试问题

**Q：你如何处理 Node.js 版本兼容性问题？**

**A：** 
1. **锁定版本**：在 `package.json` 中指定 Node.js 版本范围
2. **CI/CD 检查**：在 CI/CD 流程中检查 Node.js 版本
3. **多版本测试**：使用 GitHub Actions 测试多个 Node.js 版本
4. **降级方案**：如果新版本有 breaking changes，考虑使用 LTS 版本

**Q：为什么选择 Node.js 25 而不是 LTS 版本？**

**A：** 开发环境可以使用最新版本体验新特性，但生产环境建议使用 LTS 版本（如 Node.js 20）。这样既能体验新技术，又能保证生产稳定性。

---

## 总结

| Bug | 原因 | 解决方案 | 面试考点 |
|-----|------|----------|----------|
| 404 错误 | API 路径重复 | 修正路径配置 | 接口调试、路径管理 |
| SSE 失效 | Node.js 25 兼容性 | 使用原生 HTTP 服务器 | SSE 原理、Node.js 版本管理 |
| 版本兼容 | Node.js 25 breaking changes | 锁定版本、使用 LTS | 版本管理、CI/CD |

---

*最后更新：2026-08-10*
