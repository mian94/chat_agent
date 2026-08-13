# 开发 Bug 记录

本文档记录前端面试辅导 Agent 项目开发过程中遇到的 Bug、原因分析、解决方案，以及面试中可能被问到的相关问题。

---

## 阶段1/阶段2

### Bug #1：前端请求 404 错误

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

### Bug #2：Node.js 25 中 SSE 流式输出失效

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

### Bug #3：Node.js 版本兼容性问题

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

## 阶段3

### Bug #4：DeepSeek API错误400

#### 现象
启用Agent模式后，发送问题收到 `❌ DeepSeek API 错误 (400)`。

#### 原因分析
后端错误处理逻辑不完善，没有正确解析DeepSeek API返回的错误信息。当API返回错误时，响应体中包含详细的错误描述，但代码直接返回了通用的错误提示。

#### 解决方案
在agent-handler.ts中添加更详细的错误信息解析：

```typescript
// 尝试从响应体中提取错误信息
let errorMessage = `DeepSeek API 错误 (${apiRes.statusCode})`;
try {
  const errorData = JSON.parse(errorBody);
  if (errorData.error?.message) {
    errorMessage = errorData.error.message;
  }
} catch {}
res.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`);
```

#### 关键点
- API错误响应体通常是JSON格式，包含`error.message`字段
- 应该解析错误响应体，返回更友好的错误提示
- 使用try-catch防止解析失败导致程序崩溃

---

### Bug #5：502 Bad Gateway错误

#### 现象
发送问题请求失败，控制台报错 `POST http://localhost:5173/api/chat net::ERR_ABORTED 502 (Bad Gateway)`。

#### 原因分析
agent-handler.ts文件丢失或未正确创建，导致后端无法处理Agent请求。Vite开发服务器作为代理，当后端返回502时，说明后端服务出现了问题。

#### 解决方案
1. 检查agent-handler.ts文件是否存在
2. 确保所有必要的导入和函数定义完整
3. 重新创建agent-handler.ts文件

#### 关键点
- 502错误通常表示后端服务问题
- 检查文件是否丢失或损坏
- 确保所有依赖的模块都正确导入

---

### Bug #6：DeepSeek API错误"insufficient tool_messages"

#### 现象
用户报告错误：`❌ Duplicate value for 'tool_call_id' of call-xxx in message[2]`

#### 原因分析
这个错误涉及到DeepSeek API的"工具调用"机制。当AI决定使用工具时，它会返回一个"工具调用请求"（tool_call），然后后端执行这个工具，再把结果返回给AI。

问题出在**消息格式**上。DeepSeek API要求：
- 一个`assistant`消息可以包含多个`tool_calls`（工具调用请求）
- 但每个`tool_call`必须对应一个单独的`tool`消息（工具执行结果）

之前的代码把多个工具调用的结果放在了一个`tool`消息里，或者多个`tool`消息使用了相同的`tool_call_id`，导致DeepSeek API无法正确匹配"请求"和"结果"。

#### 解决方案
```typescript
// 正确的做法：
// 1. 一个assistant消息包含所有tool_calls
const assistantMessage = {
  role: 'assistant',
  content: null,  // 工具调用时content为null
  tool_calls: [
    { id: 'call_1', type: 'function', function: { name: 'web_search', arguments: '{"query":"Vue面试题"}' } },
    { id: 'call_2', type: 'function', function: { name: 'task_planner', arguments: '{"task":"准备面试"}' } }
  ]
};

// 2. 每个tool_call对应一个独立的tool消息
const toolMessages = [
  { role: 'tool', tool_call_id: 'call_1', content: '{"results":[...]}' },  // web_search的结果
  { role: 'tool', tool_call_id: 'call_2', content: '{"steps":[...]}' }     // task_planner的结果
];
```

#### 关键点
- `tool_call_id`必须唯一，不能重复
- 每个工具调用的结果必须单独作为一个消息返回
- 消息顺序必须是：`assistant`（包含tool_calls）→ `tool`（每个工具一个消息）

---

### Bug #7：流式响应中tool_call ID重复

#### 现象
在处理DeepSeek的流式响应时，出现错误：`Duplicate value for 'tool_call_id'`

#### 原因分析
DeepSeek API是**流式返回**的，也就是说AI的回复是"一个字一个字"发过来的。对于工具调用，AI也是分多次发送：
- 第一次发送：`{ id: 'call_123', function: { name: 'web_search' } }`
- 第二次发送：`{ function: { arguments: '{"query":"' } }`
- 第三次发送：`{ function: { arguments: 'Vue"}' } }`

我们需要把这些"碎片"拼接起来，形成完整的工具调用请求。

DeepSeek的流式响应中，`tool_call`的`id`字段可能：
- 在第一次出现时提供
- 后续的增量数据中不再包含`id`
- 或者返回空值

如果我们每次都用`toolCall.id`来识别，可能会得到重复的ID，导致冲突。

#### 解决方案
使用`index`（索引）来跟踪同一个工具调用，而不是依赖`id`：

```typescript
for (const toolCall of choice.delta.tool_calls) {
  const index = toolCall.index ?? 0;  // 使用index来识别是第几个工具调用
  
  if (toolCalls[index]) {
    // 如果这个工具调用已经存在，说明是增量数据，需要合并参数
    toolCalls[index].function.arguments += toolCall.function?.arguments || '';
  } else {
    // 如果是新的工具调用，创建新的记录
    toolCalls[index] = {
      id: toolCall.id || `call_${index}`,  // 如果没有id，用index生成一个
      type: 'function',
      function: {
        name: toolCall.function?.name || '',
        arguments: toolCall.function?.arguments || '',
      },
    };
  }
}
// 过滤掉数组中的空位
const validToolCalls = toolCalls.filter(tc => tc != null);
```

#### 关键点
- `index`是DeepSeek提供的，用于标识"这是第几个工具调用"
- 第一次出现时，`index`对应的`toolCalls`数组位置是空的，需要创建
- 后续出现时，`index`对应的`toolCalls`数组位置已经有值了，需要合并参数
- 最后过滤掉数组中的空位

---

### Bug #8：调试日志不显示

#### 现象
开启调试模式后，发送消息，前端页面没有出现调试日志区域。

#### 原因分析
调试日志是一个可选功能，用于展示AI调用工具的过程。它需要：
1. 后端发送调试事件（SSE格式）
2. 前端接收并显示这些事件

问题可能是：
- 后端没有正确发送调试事件
- 或者前端没有正确处理`debug`类型的SSE消息

#### 解决方案
**后端（agent-handler.ts）：**
```typescript
// 在工具调用前发送事件
if (debugMode || DEBUG_MODE) {
  const toolCallEvent = {
    type: 'tool_call',
    message: `调用工具: ${validToolCalls.map(tc => tc.function.name).join(', ')}`,
    timestamp: Date.now(),
  };
  res.write(`data: ${JSON.stringify({ type: 'debug', event: toolCallEvent })}\n\n`);
}

// 在工具执行完成后发送事件
const toolDetailEvent = {
  type: 'tool_result',
  message: `工具 ${tc.function.name} 执行完成`,
  toolName: tc.function.name,
  parameters: JSON.parse(tc.function.arguments),
  result: result,
  timestamp: Date.now(),
};
res.write(`data: ${JSON.stringify({ type: 'debug', event: toolDetailEvent })}\n\n`);
```

**前端（api/index.ts）：**
```typescript
// 处理debug类型的SSE消息
if (data.type === 'debug' && onDebugEvent) {
  onDebugEvent(data.event);
}
```

#### 关键点
- 调试事件必须用`res.write`发送，格式是`data: ${JSON.stringify({ type: 'debug', event: ... })}\n\n`
- 前端必须处理`type: 'debug'`的消息，并调用`onDebugEvent`回调
- 调试模式由前端开关和后端环境变量双重控制

---

### Bug #9：调试日志展开失败

#### 现象
调试日志区域显示出来了，但是点击展开按钮没有反应，无法查看详细信息。

#### 原因分析
调试日志使用Vue的条件渲染来控制内容的显示/隐藏。有两种方式：
- `v-if`：条件为false时，DOM元素会被完全移除；条件为true时，重新创建
- `v-show`：条件为false时，只是`display: none`；条件为true时，`display: block`

使用`v-if`可能导致组件状态丢失（每次展开都重新创建），`overflow: hidden`可能裁剪了内容。

#### 解决方案
**方案1：使用`v-show`代替`v-if`**
```vue
<!-- 错误写法 -->
<div v-if="expanded" class="log-content">...</div>

<!-- 正确写法 -->
<div v-show="expanded" class="log-content">...</div>
```

**方案2：移除`overflow: hidden`**
```css
.tool-call-log {
  /* 移除这行 */
  /* overflow: hidden; */
  
  /* 添加最小高度 */
  min-height: 36px;
}
```

#### 关键点
- `v-show`更适合频繁切换的场景，因为它不会销毁DOM
- `overflow: hidden`会裁剪超出容器的内容，导致内容不可见
- 添加调试日志可以帮助定位问题

---

### Bug #10：调试日志消失

#### 现象
AI回答完成后，调试日志区域消失了。

#### 原因分析
调试日志需要在整个对话过程中保持可见，直到用户发送新消息。问题可能是：
- 调试日志在消息列表之后，当消息很多时被推到视图之外
- `toolCallEvents`在发送新消息时被清空
- 调试日志没有绑定到具体的消息上

#### 解决方案
**将调试日志绑定到用户消息上：**
```typescript
// 在ChatMessage类型中添加debugEvents字段
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  mode?: TutorMode;
  debugEvents?: ToolCallEvent[];  // 新增
}

// 发送消息时创建debugEvents数组
const userMessage: ChatMessage = {
  id: `user-${Date.now()}`,
  role: 'user',
  content,
  timestamp: Date.now(),
  mode: messageMode,
  debugEvents: [],  // 初始化为空数组
};

// 接收到调试事件时，绑定到用户消息上
(event) => {
  const userMsg = session.messages.find((m) => m.id === userMessage.id);
  if (userMsg && userMsg.debugEvents) {
    userMsg.debugEvents.push(event);
  }
}
```

**在模板中显示绑定的调试日志：**
```vue
<template v-for="msg in store.activeMessages" :key="msg.id">
  <!-- 用户消息 -->
  <div v-if="msg.role === 'user'" class="message-row user">
    <div class="message-bubble">...</div>
  </div>
  
  <!-- 调试日志（绑定到用户消息上） -->
  <ToolCallLog 
    v-if="msg.role === 'user' && store.useAgentMode && store.debugMode"
    :events="msg.debugEvents || []"
  />
  
  <!-- AI消息 -->
  <div v-if="msg.role === 'assistant'" class="message-row assistant">
    <div class="message-bubble">...</div>
  </div>
</template>
```

#### 关键点
- 调试日志应该绑定到具体的用户消息上，而不是全局共享
- 每个用户消息都有自己的`debugEvents`数组
- 删除消息时，对应的调试日志也会被删除
- 刷新页面后调试日志会消失（因为它们不保存到IndexedDB）

---

### Bug #11：布局问题

#### 现象
- 打开浏览器控制台时，聊天区被覆盖
- 缩小窗口时，内容消失或布局混乱

#### 原因分析
响应式设计是指网页能够自动适应不同屏幕尺寸。主要技术包括：
- `flex`布局：灵活的盒子模型
- `media query`：根据屏幕尺寸应用不同样式
- `min-width`/`max-width`：限制元素宽度

问题可能是使用了固定的`min-width: 1000px`，导致在小屏幕上无法收缩；侧边栏没有设置`flex-shrink: 0`，被压缩了；没有针对移动端的媒体查询。

#### 解决方案
**方案1：移除固定宽度限制**
```css
/* 错误写法 */
.glass-app {
  min-width: 1000px;
}

/* 正确写法 */
.glass-app {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
```

**方案2：防止侧边栏被压缩**
```css
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  max-width: var(--sidebar-width);
  flex-shrink: 0;  /* 防止被压缩 */
}
```

**方案3：添加移动端媒体查询**
```css
/* 移动端 (< 768px) */
@media (max-width: 768px) {
  .glass-app {
    flex-direction: column;  /* 垂直排列 */
  }
  .sidebar {
    width: 100%;
    min-width: 100%;
    height: auto;
    max-height: 50vh;  /* 最大高度为视口的一半 */
  }
}
```

#### 关键点
- `flex-shrink: 0`防止元素被压缩
- `@media`查询用于针对不同屏幕尺寸应用不同样式
- `flex-direction: column`在移动端将布局改为垂直排列

---

### Bug #12：DataCloneError（IndexedDB无法克隆对象）

#### 现象
发送消息后，控制台报错：
```
Uncaught (in promise) DataCloneError: Failed to execute 'put' on 'IDBObjectStore': [object Array] could not be cloned.
```

#### 原因分析
IndexedDB是浏览器提供的本地数据库，用于存储大量数据。但是它有一个限制：**只能存储可序列化的数据**。

什么是"可序列化"？
- 简单类型（字符串、数字、布尔值）✓
- 简单对象（只有键值对，没有函数）✓
- 数组（元素都是可序列化的）✓
- 包含函数的对象 ✗
- 包含循环引用的对象 ✗
- 包含特殊类型（如Date、RegExp）的对象 ✗

`debugEvents`数组中的`ToolCallEvent`对象包含`parameters`和`result`字段，这些字段的类型是`any`，可能包含不可序列化的内容。

#### 解决方案
在保存到IndexedDB之前，移除`debugEvents`字段：

```typescript
// saveMessage函数
export async function saveMessage(message: ChatMessage & { sessionId: string }): Promise<void> {
  const db = await getDB();
  // 移除debugEvents字段，避免DataCloneError
  const { debugEvents, ...messageForDB } = message;
  await db.put('messages', messageForDB);
}

// saveSession函数
export async function saveSession(session: ChatSession): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'messages'], 'readwrite');
  
  // 保存会话元数据
  const { messages, ...meta } = session;
  await tx.objectStore('sessions').put(meta);
  
  // 保存消息（移除debugEvents字段）
  for (const msg of messages) {
    const { debugEvents, ...msgForDB } = msg;
    await tx.objectStore('messages').put({ ...msgForDB, sessionId: session.id });
  }
  
  await tx.done;
}
```

#### 关键点
- `const { debugEvents, ...messageForDB } = message`是ES6的解构语法，意思是：
  - 从`message`中取出`debugEvents`字段（用`_`表示不使用）
  - 剩余的字段组成新对象`messageForDB`
- 这样`messageForDB`就不包含`debugEvents`字段了，可以安全地保存到IndexedDB
- 调试日志是临时数据，不需要持久化，刷新页面后消失是正常的

---

### Bug #13：调试日志无法实时更新

#### 现象
开启调试模式后，调试日志区域显示的事件数量一直为0，需要手动关闭再展开才能看到更新后的数据。控制台显示事件确实在不断接收（事件总数从1增加到15），但ToolCallLog组件显示的events数量一直是0。

#### 原因分析
这是**Vue computed属性的深层响应式追踪问题**。

在store中，`activeMessages`是computed属性：
```typescript
const activeMessages = computed(() => {
  return activeSession.value?.messages || [];
});
```

当修改`session.messages`数组中元素的属性（如`debugEvents`）时：
```typescript
// ❌ 这种方式Vue无法追踪到变化
userMsg.debugEvents.push(event);
```

Vue的响应式系统通过Proxy追踪对象变化，但对数组的`push`等变异方法在深层嵌套场景下可能无法正确检测。虽然`debugEvents`数组被替换为新数组，但Vue的computed属性依赖追踪是基于引用的，而不是深层内容的。

#### 解决方案
**方案1：使用展开运算符创建新数组**
```typescript
// ✅ 使用展开运算符创建新数组，触发Vue响应式更新
userMsg.debugEvents = [...userMsg.debugEvents, event];
```

**方案2：强制触发sessions的响应式更新**
```typescript
// ✅ 强制触发sessions的响应式更新
sessions.value = [...sessions.value];
```

**完整代码：**
```typescript
// onDebugEvent回调
(event) => {
  const userMsg = session.messages.find((m) => m.id === userMessage.id);
  if (userMsg) {
    if (!userMsg.debugEvents) {
      userMsg.debugEvents = [];
    }
    // 使用展开运算符创建新数组，触发Vue响应式更新
    userMsg.debugEvents = [...userMsg.debugEvents, event];
    // 强制触发sessions的响应式更新
    sessions.value = [...sessions.value];
  }
}
```

#### 关键点
- Vue3的响应式系统对深层嵌套的对象/数组的追踪有限制
- 使用展开运算符创建新数组引用，可以确保Vue检测到变化
- `sessions.value = [...sessions.value]`创建新的数组引用，触发所有computed属性重新计算
- 这种方式比`push`更符合Vue的响应式设计理念

---

## 阶段4

### Bug #14：问答模式参考资料链接显示为普通文字

#### 现象
问答模式下，Agent生成的回答中参考资料部分只显示链接文字，没有可点击的URL。例如：
```
五、参考资料
Vue3 官方文档 - 响应式基础
Vue3 响应式系统原理深度解析 - 腾讯云
深入解析 Vue3 响应式系统 - CSDN
```
实际应该显示为：
```
[Vue3 官方文档 - 响应式基础](https://vuejs.org/xxx)
[Vue3 响应式系统原理深度解析 - 腾讯云](https://cloud.tencent.com/xxx)
```

#### 原因分析
问题出在**知识整理工具丢失URL信息**。

数据流程：
1. `web_search`工具返回了完整的 `title` + `url`
2. `knowledge_organize`工具在整理内容时，只处理文本内容，**没有保留URL**
3. Agent最终生成回答时，只看到了整理后的文本，没有URL，所以只能写出链接文字

#### 解决方案
**修改knowledge_organize工具**，使其在整理内容时保留URL信息：

```typescript
function generateOutline(content: string, topic: string): string {
  // 提取所有URL
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls: string[] = [];
  let match;
  while ((match = urlPattern.exec(content)) !== null) {
    urls.push(match[0]);
  }
  
  // 大纲生成时保留URL
  // ...
  
  // 在末尾添加完整的参考链接列表
  if (urls.length > 0) {
    outline.push(`\n## 参考链接\n`);
    for (const url of urls) {
      outline.push(`- ${url}\n`);
    }
  }
  
  return outline.join('');
}
```

**同时优化System Prompt**，明确要求Agent使用标准Markdown链接格式：

```markdown
## 链接格式规范（非常重要）
- 引用来源时必须使用标准Markdown链接格式：[链接文字](URL)
- 例如：[Vue3官方文档](https://vuejs.org/)
- 不要只写链接文字不写URL，也不要只写URL不写链接文字
- 参考资料部分必须列出完整的可点击链接
- 示例格式：
  - [Vue3 响应式系统原理深度解析 - 腾讯云](https://cloud.tencent.com/xxx)
  - [深入解析 Vue3 响应式系统 - CSDN](https://blog.csdn.net/xxx)
```

#### 关键点
- 工具链中的数据传递需要保留完整信息，不能只传递部分内容
- System Prompt需要明确、具体的格式要求，最好包含示例
- 搜索结果的URL是重要的参考信息，需要在整个处理流程中保持完整

---

## 总结

### 阶段1/阶段2

| Bug | 原因 | 解决方案 | 面试考点 |
|-----|------|----------|----------|
| 404 错误 | API 路径重复 | 修正路径配置 | 接口调试、路径管理 |
| SSE 失效 | Node.js 25 兼容性 | 使用原生 HTTP 服务器 | SSE 原理、Node.js 版本管理 |
| 版本兼容 | Node.js 25 breaking changes | 锁定版本、使用 LTS | 版本管理、CI/CD |

### 阶段3

| Bug | 原因 | 解决方案 | 面试考点 |
|-----|------|----------|----------|
| API错误400 | 错误处理不完善 | 解析错误响应体 | 错误处理、API调试 |
| 502错误 | 文件丢失 | 检查文件完整性 | 服务端问题排查 |
| tool_messages格式错误 | 消息格式不符合API要求 | 规范消息格式 | Function Calling机制 |
| tool_call ID重复 | 流式响应中ID处理不当 | 使用index跟踪 | 流式数据处理 |
| 调试日志不显示 | 事件未正确发送/接收 | 完善事件处理链路 | SSE事件处理 |
| 调试日志展开失败 | v-if导致状态丢失 | 使用v-show | Vue条件渲染 |
| 调试日志消失 | 未绑定到消息 | 绑定到用户消息 | 状态管理 |
| 布局问题 | 固定宽度限制 | 响应式设计 | CSS布局、媒体查询 |
| DataCloneError | 不可序列化字段 | 移除debugEvents | IndexedDB限制 |
| 调试日志无法实时更新 | Vue computed深层追踪限制 | 展开运算符+强制更新 | Vue响应式原理 |

### 阶段4

| Bug | 原因 | 解决方案 | 面试考点 |
|-----|------|----------|----------|
| 参考资料链接显示为普通文字 | 知识整理工具丢失URL | 保留URL+优化Prompt | 工具链数据传递、Prompt工程 |

---

*最后更新：2026-08-12*
