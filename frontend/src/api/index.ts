import request from './request';
import type { ApiResponse, HealthCheckResponse, ChatMessage, TutorMode, ToolCallEvent } from '@/types';

/** 健康检查 */
export async function checkHealth(): Promise<ApiResponse<HealthCheckResponse>> {
  const res = await request.get<ApiResponse<HealthCheckResponse>>('/health');
  return res.data;
}

/** 发送聊天消息（SSE 流式） */
export async function sendChatMessage(
  messages: Pick<ChatMessage, 'role' | 'content'>[],
  mode: TutorMode,
  shouldIntroduce: boolean,
  onDelta: (content: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
    const response = await fetch(`${baseURL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, mode, shouldIntroduce }),
    });

    if (!response.ok) {
      onError(`请求失败 (${response.status})`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('无法读取响应流');
      return;
    }

    // 使用 fatal: false 和 ignoreBOM 的 TextDecoder
    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 使用 stream: true 确保多字节字符被正确处理
      const decoded = decoder.decode(value, { stream: true });

      buffer += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'delta') {
            onDelta(data.content);
          } else if (data.type === 'done') {
            onDone();
            return;
          } else if (data.type === 'error') {
            onError(data.message);
            return;
          }
        } catch {
          // JSON 解析失败，跳过
        }
      }
    }

    // 流读取完毕
    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : '网络连接失败');
  }
}

/** 发送Agent聊天消息（支持工具调用） */
export async function sendAgentChatMessage(
  messages: Pick<ChatMessage, 'role' | 'content'>[],
  mode: TutorMode,
  shouldIntroduce: boolean,
  debugMode: boolean,
  onDelta: (content: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  onDebugEvent?: (event: ToolCallEvent) => void,
): Promise<void> {
  try {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
    const response = await fetch(`${baseURL}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, mode, shouldIntroduce, debugMode }),
    });

    if (!response.ok) {
      onError(`请求失败 (${response.status})`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('无法读取响应流');
      return;
    }

    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'delta') {
            onDelta(data.content);
          } else if (data.type === 'debug' && onDebugEvent) {
            onDebugEvent(data.event);
          } else if (data.type === 'done') {
            onDone();
            return;
          } else if (data.type === 'error') {
            onError(data.message);
            return;
          }
        } catch {
          // JSON 解析失败，跳过
        }
      }
    }

    // 流读取完毕
    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : '网络连接失败');
  }
}
