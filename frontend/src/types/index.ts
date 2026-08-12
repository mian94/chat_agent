/** 聊天消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** 发送时的辅导模式（记录历史上下文） */
  mode?: TutorMode;
  /** 工具调用信息（可选） */
  toolCalls?: ToolCallInfo[];
  /** 调试日志（仅用户消息，用于显示工具调用过程） */
  debugEvents?: ToolCallEvent[];
}

/** 工具调用信息 */
export interface ToolCallInfo {
  name: string;
  arguments: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

/** 辅导模式 */
export type TutorMode = 'quiz' | 'qa' | 'mock';

/** 会话 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
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

/** 调试日志 */
export interface DebugLog {
  id: string;
  timestamp: number;
  toolName: string;
  parameters: any;
  status: 'executing' | 'success' | 'error';
  result?: any;
  error?: string;
  duration?: number;
  llmDecision?: string;
  reflection?: string;
}

/** 工具调用事件 */
export interface ToolCallEvent {
  type: 'tool_call' | 'tool_result' | 'reflection' | 'task_plan';
  toolName?: string;
  parameters?: any;
  result?: any;
  message: string;
  timestamp: number;
  debugLog?: DebugLog;
}

/** Agent消息（扩展版） */
export interface AgentMessage extends ChatMessage {
  debugLogs?: DebugLog[];
  toolCallEvents?: ToolCallEvent[];
}
