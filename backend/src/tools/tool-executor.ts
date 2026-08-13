/**
 * 工具执行器
 * 负责根据工具名称和参数执行相应的工具
 */

import type { ToolCall, ToolResult, DebugLog } from '../types';
import { webSearch } from './web-search';
import { taskPlanner } from './task-planner';
import { knowledgeOrganize } from './knowledge-organize';
import { questionGenerator } from './question-generator';
import { answerEvaluator } from './answer-evaluator';

/** 工具执行函数映射 */
const toolExecutors: Record<string, (params: Record<string, any>) => Promise<ToolResult>> = {
  web_search: webSearch as (params: Record<string, any>) => Promise<ToolResult>,
  task_planner: taskPlanner as (params: Record<string, any>) => Promise<ToolResult>,
  knowledge_organize: knowledgeOrganize as (params: Record<string, any>) => Promise<ToolResult>,
  question_generator: questionGenerator as (params: Record<string, any>) => Promise<ToolResult>,
  answer_evaluator: answerEvaluator as (params: Record<string, any>) => Promise<ToolResult>,
};

/**
 * 执行单个工具调用
 * @param toolCall 工具调用信息
 * @param debugMode 是否开启调试模式
 * @returns 工具执行结果
 */
export async function executeTool(
  toolCall: ToolCall,
  debugMode: boolean = false
): Promise<{ result: ToolResult; debugLog?: DebugLog }> {
  const startTime = Date.now();
  
  // 记录调试日志
  const debugLog: DebugLog = {
    id: `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    toolName: toolCall.function.name,
    parameters: toolCall.function.arguments,
    status: 'executing',
  };

  if (debugMode) {
    console.log(`[调试模式] 开始执行工具: ${toolCall.function.name}`);
    console.log(`[调试模式] 参数:`, JSON.stringify(toolCall.function.arguments, null, 2));
  }

  try {
    // 查找工具执行函数
    const executor = toolExecutors[toolCall.function.name];
    if (!executor) {
      const errorResult: ToolResult = {
        success: false,
        error: `未知工具: ${toolCall.function.name}`,
        toolCallId: toolCall.id,
      };
      
      debugLog.status = 'error';
      debugLog.error = errorResult.error;
      debugLog.duration = Date.now() - startTime;
      
      return { result: errorResult, debugLog: debugMode ? debugLog : undefined };
    }

    // 解析参数
    let params: Record<string, any>;
    try {
      params = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments) 
        : toolCall.function.arguments;
    } catch (e) {
      const errorResult: ToolResult = {
        success: false,
        error: `参数解析失败: ${e instanceof Error ? e.message : String(e)}`,
        toolCallId: toolCall.id,
      };
      
      debugLog.status = 'error';
      debugLog.error = errorResult.error;
      debugLog.duration = Date.now() - startTime;
      
      return { result: errorResult, debugLog: debugMode ? debugLog : undefined };
    }

    // 执行工具
    const result = await executor(params);
    
    debugLog.status = result.success ? 'success' : 'error';
    debugLog.result = result;
    debugLog.duration = Date.now() - startTime;

    if (debugMode) {
      console.log(`[调试模式] 工具执行完成: ${toolCall.function.name}`);
      console.log(`[调试模式] 耗时: ${debugLog.duration}ms`);
      console.log(`[调试模式] 结果:`, result.success ? '成功' : '失败');
    }

    return { result, debugLog: debugMode ? debugLog : undefined };
  } catch (error) {
    const errorResult: ToolResult = {
      success: false,
      error: `工具执行异常: ${error instanceof Error ? error.message : String(error)}`,
      toolCallId: toolCall.id,
    };
    
    debugLog.status = 'error';
    debugLog.error = errorResult.error;
    debugLog.duration = Date.now() - startTime;
    
    console.error(`[工具执行器] 工具 ${toolCall.function.name} 执行异常:`, error);
    
    return { result: errorResult, debugLog: debugMode ? debugLog : undefined };
  }
}

/**
 * 执行多个工具调用（并行执行）
 * @param toolCalls 工具调用列表
 * @param debugMode 是否开启调试模式
 * @returns 工具执行结果列表
 */
export async function executeTools(
  toolCalls: ToolCall[],
  debugMode: boolean = false
): Promise<{ results: ToolResult[]; debugLogs: DebugLog[] }> {
  const results: ToolResult[] = [];
  const debugLogs: DebugLog[] = [];

  // 并行执行所有工具调用
  const promises = toolCalls.map(async (toolCall) => {
    const { result, debugLog } = await executeTool(toolCall, debugMode);
    return { result, debugLog };
  });

  const outcomes = await Promise.all(promises);
  
  for (const outcome of outcomes) {
    results.push(outcome.result);
    if (outcome.debugLog) {
      debugLogs.push(outcome.debugLog);
    }
  }

  return { results, debugLogs };
}

/**
 * 检查工具是否存在
 * @param toolName 工具名称
 * @returns 是否存在
 */
export function toolExists(toolName: string): boolean {
  return toolName in toolExecutors;
}

/**
 * 获取所有可用工具名称
 * @returns 工具名称列表
 */
export function getAvailableTools(): string[] {
  return Object.keys(toolExecutors);
}
