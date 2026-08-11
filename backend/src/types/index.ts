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
