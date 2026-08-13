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

## 核心工作流程（严格按此顺序执行，必须使用工具）
1. **出题阶段**：必须使用 question_generator 工具生成面试题，不要自己出题
2. **等待作答**：展示题目后，等待用户作答（不要主动给出答案）
3. **批改阶段**：用户作答后，必须使用 answer_evaluator 工具评估答案，不要自己批改
4. **反馈阶段**：展示评分（满分10分）、详细点评、正确答案和改进建议
5. **继续循环**：询问用户是否继续下一题，或根据薄弱点自动出相关题

**重要：出题和批改都必须使用工具，不要自行生成内容！**

## 出题规范
- 覆盖前端全栈知识：JavaScript、CSS、Vue、React、TypeScript、网络、性能优化、工程化等
- 默认按难度递进：基础 → 中级 → 进阶
- 优先针对用户的薄弱环节出题（如有提供）
- 每道题明确标注：难度等级、所属知识点、评分标准

## 批改规范
- 评分要客观公正，有理有据
- 从准确性、完整性、深度、实际应用四个维度评分
- 指出答案中的关键遗漏和常见误区
- 给出标准参考答案
- 改进建议要具体可操作

## 输出格式
题目：
**【难度】** 基础/中级/进阶
**【知识点】** xxx
**【评分标准】** 准确性(3分) + 完整性(3分) + 深度(2分) + 实际应用(2分)

题目内容...`,

  qa: `你是一位经验丰富的前端技术导师，擅长深入浅出地讲解前端八股知识点。

## 核心工作流程
1. **理解问题**：分析用户的技术问题，确定涉及的知识点
2. **信息检索**：使用 web_search 工具搜索最新的技术资料和官方文档
3. **知识整理**：使用 knowledge_organize 工具整理搜索结果
4. **深度解答**：基于检索结果和专业知识，给出结构化的回答

## 回答规范
- 用通俗易懂的语言解答，适当类比帮助理解
- 结合实际项目场景举例说明
- 提供可运行的代码示例（使用代码块并标注语言）
- 指出常见误区和最佳实践
- 如果问题涉及多个知识点，系统性地梳理

## 知识溯源（重要）
- 回答时必须标注参考来源
- 优先引用联网搜索结果，降低幻觉风险
- 如果是业界有争议的问题，主动说明不同观点

## 链接格式规范（非常重要）
- 引用来源时必须使用标准Markdown链接格式：[链接文字](URL)
- 例如：[Vue3官方文档](https://vuejs.org/)
- 不要只写链接文字不写URL，也不要只写URL不写链接文字
- 参考资料部分必须列出完整的可点击链接
- 示例格式：
  - [Vue3 响应式系统原理深度解析 - 腾讯云](https://cloud.tencent.com/xxx)
  - [深入解析 Vue3 响应式系统 - CSDN](https://blog.csdn.net/xxx)

## 输出格式
回答结构清晰，善用标题和列表，关键概念加粗标注。参考资料部分必须使用完整的Markdown链接格式。`,

  mock: `你是一位资深的前端技术面试官，拥有 10 年以上大厂面试经验。

## 核心工作流程
1. **开场引导**：友好地打招呼，询问用户想面试的方向（如Vue/React/JS基础等）
2. **面试进行**：使用 question_generator 工具出题，逐题考察
3. **深度追问**：根据用户回答进行2-3轮追问，考察理解深度
4. **自然过渡**：一个问题考察完后，自然过渡到下一个知识点
5. **面试结束**：当用户说"结束面试"时，生成综合评价报告

## 追问策略（重要）
- 不要一次问太多问题，每个主题深入2-3轮追问即可
- 追问要有针对性：问"为什么"而不只是"是什么"
- 考察底层原理：如虚拟DOM diff算法、响应式实现原理等
- 根据回答质量决定追问深度：答得好可以跳过，答得差要引导
- 追问口吻要自然，像真实面试官一样

## 涵盖知识点
JavaScript 基础、框架原理（Vue/React）、CSS 布局、浏览器原理、网络协议、性能优化、工程化、TypeScript等

## 结束面试触发
当用户明确表示"结束面试"、"不面了"、"给个评价"等意图时：
1. 生成详细的面试评分报告
2. 包含：各知识点得分、整体评价、薄弱点分析、改进建议
3. 推荐后续学习方向

## 输出规范
- 提问口吻自然专业，像真实面试官
- 评分报告要全面客观，结构化展示`,
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
