/**
 * SSE 聊天处理器
 * 使用原生 HTTP 类型，完整读取 DeepSeek API 响应后用 setTimeout 分块发送
 */

import type { IncomingMessage, ServerResponse } from 'http';
import https from 'https';
import { getSystemPrompt } from './services/deepseek';
import type { ChatMessage } from './types';

/**
 * 处理 SSE 聊天请求
 */
export function handleChatSSE(req: IncomingMessage, res: ServerResponse, body: string): void {
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '无效的 JSON' }));
    return;
  }

  const { messages, mode, shouldIntroduce } = parsed;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '消息列表不能为空' }));
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'DEEPSEEK_API_KEY 未配置' }));
    return;
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (req.socket) req.socket.setNoDelay(true);

  // 构造消息列表
  let systemPrompt = getSystemPrompt(mode || 'qa');
  
  // 如果需要表明身份，在系统提示词后添加指令
  if (shouldIntroduce) {
    systemPrompt += '\n\n请在回复的第一句话中简要说明你的身份和当前模式，例如"我是你的前端技术导师"或"我是你的面试出题老师"。';
  }
  
  const deepseekMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m: Pick<ChatMessage, 'role' | 'content'>) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // 客户端断开连接时中止
  let aborted = false;
  req.on('close', () => { aborted = true; });

  // 用原生 https 模块调用 DeepSeek API
  const requestBody = JSON.stringify({
    model: 'deepseek-chat',
    messages: deepseekMessages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  });

  const url = new URL('https://api.deepseek.com/chat/completions');
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(requestBody),
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    if (apiRes.statusCode !== 200) {
      let errorBody = '';
      apiRes.on('data', (chunk) => { errorBody += chunk; });
      apiRes.on('end', () => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: `DeepSeek API 错误 (${apiRes.statusCode})` })}\n\n`);
        res.end();
      });
      return;
    }

    // 先完整读取所有数据
    let rawData = '';
    const decoder = new TextDecoder();
    apiRes.on('data', (chunk: Buffer) => {
      // 使用 TextDecoder 正确处理多字节字符
      rawData += decoder.decode(chunk, { stream: true });
    });

    apiRes.on('end', () => {
      // 刷新解码器，确保所有缓存的字节都被处理
      rawData += decoder.decode();
      // 解析所有 SSE 数据
      const deltas: string[] = [];
      const lines = rawData.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            // 确保content是字符串
            const content = typeof delta.content === 'string' 
              ? delta.content 
              : JSON.stringify(delta.content);
            deltas.push(content);
          }
        } catch {}
      }

      // 直接发送所有数据
      for (let i = 0; i < deltas.length; i++) {
        const sseData = `data: ${JSON.stringify({ type: 'delta', content: deltas[i] })}\n\n`;
        res.write(sseData);
      }
      
      // 发送 done 事件
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });
  });

  apiReq.on('error', (error) => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  });

  apiReq.write(requestBody);
  apiReq.end();
}
