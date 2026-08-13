/**
 * Agent 处理器
 * 处理工具调用、任务规划、反思迭代等Agent核心功能
 */

import type { IncomingMessage, ServerResponse } from 'http';
import https from 'https';
import { getSystemPrompt } from './services/deepseek';
import type { ChatMessage, ToolCall, ToolResult, DebugLog, ToolCallEvent } from './types';
import { executeTools, toolDescriptions } from './tools';

/** 最大工具调用轮次 */
const MAX_TOOL_ROUNDS = 5;

/** 调试模式开关（可通过环境变量控制） */
const DEBUG_MODE = process.env.AGENT_DEBUG_MODE === 'true';

/**
 * 处理Agent聊天请求
 * 支持工具调用、任务规划、反思迭代
 */
export function handleAgentChat(req: IncomingMessage, res: ServerResponse, body: string): void {
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '无效的 JSON' }));
    return;
  }

  const { messages, mode, shouldIntroduce, debugMode = false, maxToolRounds = MAX_TOOL_ROUNDS, weakPointsSummary } = parsed;

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

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (req.socket) req.socket.setNoDelay(true);

  // 客户端断开连接时中止
  let aborted = false;
  req.on('close', () => { aborted = true; });

  // 构造消息列表
  let systemPrompt = getSystemPrompt(mode || 'qa');
  
  // 如果需要表明身份，在系统提示词后添加指令
  if (shouldIntroduce) {
    systemPrompt += '\n\n请在回复的第一句话中简要说明你的身份和当前模式，例如"我是你的前端技术导师"或"我是你的面试出题老师"。';
  }

  // 注入薄弱点上下文（如果有）
  if (weakPointsSummary) {
    systemPrompt += weakPointsSummary;
  }

  // 添加工具调用相关的系统提示
  systemPrompt += `\n\n## 工具使用说明
你可以使用以下工具来帮助用户：
1. **web_search**: 搜索互联网获取最新信息
2. **task_planner**: 将复杂任务拆分为多个步骤
3. **knowledge_organize**: 整理和组织知识点
4. **question_generator**: 生成面试题
5. **answer_evaluator**: 评估用户答案

## 工作流程
1. 分析用户问题，判断是否需要使用工具
2. 如果需要，选择合适的工具并调用
3. 根据工具返回结果，生成最终回答
4. 对于复杂任务，使用task_planner进行任务拆分

## 反思机制
- 工具执行后，评估结果是否满足需求
- 如果不满足，可以继续调用其他工具或调整策略
- 避免无限循环，最多进行${maxToolRounds}轮工具调用`;

  const deepseekMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m: Pick<ChatMessage, 'role' | 'content'>) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // 开始Agent处理循环
  processAgentLoop(deepseekMessages, apiKey, res, aborted, debugMode, maxToolRounds, 0, []);
}

/**
 * 处理Agent循环
 * 实现工具调用循环和反思迭代
 */
async function processAgentLoop(
  messages: Array<{ role: string; content: string | null; tool_calls?: any[] }>,
  apiKey: string,
  res: ServerResponse,
  aborted: boolean,
  debugMode: boolean,
  maxRounds: number,
  currentRound: number,
  toolCallHistory: Array<{ toolCall: ToolCall; result: ToolResult; debugLog?: DebugLog }>
): Promise<void> {
  if (aborted) return;

  // 发送调试信息：开始新一轮
  if (debugMode || DEBUG_MODE) {
    const event: ToolCallEvent = {
      type: 'reflection',
      message: `开始第 ${currentRound + 1} 轮处理`,
      timestamp: Date.now(),
    };
    res.write(`data: ${JSON.stringify({ type: 'debug', event })}\n\n`);
  }

  // 构造请求体
  const requestBody: any = {
    model: 'deepseek-chat',
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  };

  // 添加工具描述（如果不是最后一轮）
  if (currentRound < maxRounds) {
    requestBody.tools = toolDescriptions.tools;
    requestBody.tool_choice = 'auto';
  }

  // 调用DeepSeek API
  const url = new URL('https://api.deepseek.com/chat/completions');
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(JSON.stringify(requestBody)),
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    if (apiRes.statusCode !== 200) {
      let errorBody = '';
      apiRes.on('data', (chunk) => { errorBody += chunk; });
      apiRes.on('end', () => {
        console.error(`[Agent] DeepSeek API 错误 (${apiRes.statusCode}):`, errorBody);
        // 尝试解析错误信息
        let errorMessage = `DeepSeek API 错误 (${apiRes.statusCode})`;
        try {
          const errorData = JSON.parse(errorBody);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {}
        res.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`);
        res.end();
      });
      return;
    }

    // 读取完整响应
    let rawData = '';
    const decoder = new TextDecoder();
    apiRes.on('data', (chunk: Buffer) => {
      rawData += decoder.decode(chunk, { stream: true });
    });

    apiRes.on('end', async () => {
      rawData += decoder.decode();
      
      // 解析SSE数据
      const deltas: string[] = [];
      const toolCalls: ToolCall[] = [];
      let hasToolCalls = false;
      
      const lines = rawData.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          
          if (choice?.delta?.content) {
            deltas.push(choice.delta.content);
          }
          
          // 检查是否有工具调用
          if (choice?.delta?.tool_calls) {
            hasToolCalls = true;
            for (const toolCall of choice.delta.tool_calls) {
              const index = toolCall.index ?? 0;
              
              // 使用index来跟踪同一个工具调用
              if (toolCalls[index]) {
                // 已存在，合并参数
                toolCalls[index].function.arguments += toolCall.function?.arguments || '';
              } else {
                // 新建工具调用
                toolCalls[index] = {
                  id: toolCall.id || `call_${index}`,
                  type: 'function',
                  function: {
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || '',
                  },
                };
              }
            }
          }
        } catch {}
      }

      // 过滤掉undefined（使用index赋值可能留下空位）
      const validToolCalls = toolCalls.filter(tc => tc != null);

      // 如果有工具调用，执行工具
      if (hasToolCalls && validToolCalls.length > 0 && currentRound < maxRounds) {
        // 发送工具调用事件
        const toolCallEvent: ToolCallEvent = {
          type: 'tool_call',
          message: `调用工具: ${validToolCalls.map(tc => tc.function.name).join(', ')}`,
          timestamp: Date.now(),
        };
        res.write(`data: ${JSON.stringify({ type: 'debug', event: toolCallEvent })}\n\n`);

        // 执行工具
        const { results, debugLogs } = await executeTools(validToolCalls, debugMode || DEBUG_MODE);

        // 为每个工具调用发送详细的调试事件
        for (let i = 0; i < validToolCalls.length; i++) {
          const tc = validToolCalls[i];
          const result = results[i];
          const debugLog = debugLogs[i];
          
          const toolDetailEvent: ToolCallEvent = {
            type: 'tool_result',
            message: `工具 ${tc.function.name} 执行完成`,
            toolName: tc.function.name,
            parameters: typeof tc.function.arguments === 'string' 
              ? JSON.parse(tc.function.arguments) 
              : tc.function.arguments,
            result: result,
            debugLog: debugMode || DEBUG_MODE ? {
              id: `debug-${Date.now()}-${i}`,
              timestamp: Date.now(),
              toolName: tc.function.name,
              parameters: typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : tc.function.arguments,
              duration: debugLog?.duration,
              status: debugLog?.status || (result.success ? 'success' : 'error'),
              result: result,
            } : undefined,
            timestamp: Date.now(),
          };
          res.write(`data: ${JSON.stringify({ type: 'debug', event: toolDetailEvent })}\n\n`);
        }

        // 更新工具调用历史
        const newHistory = [
          ...toolCallHistory,
          ...validToolCalls.map((tc, i) => ({
            toolCall: tc,
            result: results[i],
            debugLog: debugLogs[i],
          })),
        ];

        // 构建符合DeepSeek API格式的消息
        // 1. assistant消息包含所有tool_calls
        const assistantMessage = {
          role: 'assistant' as const,
          content: null,
          tool_calls: validToolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        };

        // 2. 每个tool_call对应一个tool消息
        const toolResultMessages = results.map((result, i) => ({
          role: 'tool' as const,
          tool_call_id: toolCalls[i].id,
          content: JSON.stringify(result),
        }));

        // 继续循环
        processAgentLoop(
          [...messages, assistantMessage, ...toolResultMessages],
          apiKey,
          res,
          aborted,
          debugMode,
          maxRounds,
          currentRound + 1,
          newHistory
        );
      } else {
        // 没有工具调用或达到最大轮次，发送最终响应
        for (const delta of deltas) {
          res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
        }
        
        // 发送调试总结
        if (debugMode || DEBUG_MODE) {
          const summaryEvent: ToolCallEvent = {
            type: 'reflection',
            message: `处理完成，共执行 ${currentRound} 轮工具调用`,
            timestamp: Date.now(),
          };
          res.write(`data: ${JSON.stringify({ type: 'debug', event: summaryEvent })}\n\n`);
        }
        
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      }
    });
  });

  apiReq.on('error', (error) => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  });

  apiReq.write(JSON.stringify(requestBody));
  apiReq.end();
}
