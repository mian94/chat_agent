/**
 * DeepSeek API 流式调用服务
 * 先读取完整流式响应到缓冲区，再通过 timer 回调分块写入客户端
 */

import type { TutorMode } from '../types';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

/** DeepSeek API 消息格式 */
interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 流式回调函数 */
export interface StreamCallbacks {
  onDelta: (content: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

/** 各辅导模式的系统 Prompt */
const SYSTEM_PROMPTS: Record<TutorMode, string> = {
  quiz: `你是一位专业的前端八股面试出题与批改老师。

## 你的职责
1. 根据用户指定的知识点或薄弱环节，自动生成前端面试题
2. 等待用户作答后，给出评分（满分 10 分）、详细点评和改进建议
3. 如果用户没有指定方向，主动推荐高频考点
4. 按难度递进出题：基础 → 中级 → 进阶
5. 每道题附上评分标准

## 输出规范
- 题目格式清晰，使用 Markdown
- 代码示例使用代码块并标注语言
- 评分要客观公正，有理有据
- 改进建议要具体可操作`,

  qa: `你是一位经验丰富的前端技术导师，擅长深入浅出地讲解前端八股知识点。

## 你的职责
1. 用通俗易懂的语言解答用户的前端技术问题
2. 结合实际项目场景举例说明
3. 必要时提供代码示例
4. 指出常见误区和最佳实践
5. 如果问题涉及多个知识点，系统性地梳理

## 输出规范
- 回答结构清晰，善用标题和列表
- 代码示例使用代码块并标注语言
- 关键概念加粗标注
- 适当类比帮助理解`,

  mock: `你是一位资深的前端技术面试官，拥有 10 年以上大厂面试经验。

## 你的职责
1. 模拟真实的前端技术面试场景
2. 从基础到进阶逐步深入提问
3. 根据用户回答进行追问，考察理解深度
4. 在面试结束后给出综合评价和改进建议
5. 涵盖：JavaScript 基础、框架原理、CSS 布局、性能优化、工程化、算法等

## 面试流程
1. 先做简单自我介绍引导
2. 从用户选择的方向开始提问
3. 每题根据回答质量决定是否追问
4. 面试结束后给出详细评分报告

## 输出规范
- 提问口吻自然，像真实面试官
- 追问要有针对性，考察底层原理
- 评分报告要全面客观`,
};

/**
 * 获取指定模式的系统 Prompt
 */
export function getSystemPrompt(mode: TutorMode): string {
  return SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.qa;
}

/**
 * 调用 DeepSeek API 并流式返回结果
 * 逐块读取并实时回调，利用 await 让出事件循环实现流式刷新
 */
export async function streamChatCompletion(
  messages: DeepSeekMessage[],
  callbacks: StreamCallbacks,
): Promise<void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    callbacks.onError(new Error('DEEPSEEK_API_KEY 未配置，请在 .env 文件中设置'));
    return;
  }

  try {
    console.log('[DeepSeek] 开始调用 API...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    console.log('[DeepSeek] API 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(
        new Error(`DeepSeek API 错误 (${response.status}): ${errorText}`),
      );
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError(new Error('无法获取响应流'));
      return;
    }

    console.log('[DeepSeek] 开始读取流...');
    const decoder = new TextDecoder();
    let buffer = '';
    let count = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      count++;
      if (count === 1) console.log('[DeepSeek] 收到第一个 chunk');
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            callbacks.onDelta(delta.content);
          }
        } catch {
          // 跳过无法解析的 JSON
        }
      }
    }

    console.log('[DeepSeek] 流读取完成，共', count, '个 chunks');
    callbacks.onDone();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[DeepSeek] API 调用超时');
      callbacks.onError(new Error('DeepSeek API 调用超时'));
    } else {
      console.error('[DeepSeek] API 调用错误:', error);
      callbacks.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
