/** 聊天消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** 工具调用信息（可选） */
  toolCalls?: ToolCallInfo[];
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
  mode: TutorMode;
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
