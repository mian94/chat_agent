/** 聊天消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

/** 辅导模式 */
export type TutorMode = 'quiz' | 'qa' | 'mock';

/** 聊天会话 */
export interface ChatSession {
  id: string;
  title: string;
  mode: TutorMode;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/** 聊天请求体 */
export interface ChatRequest {
  messages: Pick<ChatMessage, 'role' | 'content'>[];
  mode: TutorMode;
}

/** API 通用响应 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** 健康检查响应 */
export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  version: string;
}

/** 工具调用信息 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string | Record<string, any>;
  };
}

/** 工具执行结果 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  toolCallId?: string;
}

/** 调试日志 */
export interface DebugLog {
  id: string;
  timestamp: number;
  toolName: string;
  parameters: any;
  status: 'executing' | 'success' | 'error';
  result?: ToolResult;
  error?: string;
  duration?: number;
  llmDecision?: string;
  reflection?: string;
}

/** 工具调用事件（前端可视化用） */
export interface ToolCallEvent {
  type: 'tool_call' | 'tool_result' | 'reflection' | 'task_plan';
  toolName?: string;
  parameters?: any;
  result?: any;
  message: string;
  timestamp: number;
  debugLog?: DebugLog;
}

/** 聊天请求体（扩展版，支持工具调用） */
export interface ChatRequestExtended extends ChatRequest {
  debugMode?: boolean;
  maxToolRounds?: number;
}
