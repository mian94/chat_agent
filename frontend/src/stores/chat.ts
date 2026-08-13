import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ChatSession, ChatMessage, TutorMode, ToolCallEvent, WeakPoint } from '@/types';
import { sendChatMessage, sendAgentChatMessage } from '@/api';
import {
  getAllSessions,
  saveSession,
  deleteSession as deleteSessionFromDB,
  saveMessage,
  deleteMessage as deleteMessageFromDB,
  clearAllData,
  getAllWeakPoints,
  getUnmasteredWeakPoints,
  saveWeakPoint,
  saveWeakPoints,
  markWeakPointMastered,
  deleteWeakPoint,
  getWeakPointStats,
} from '@/utils/db';

/** 模式显示名称映射 */
export const MODE_LABELS: Record<TutorMode, string> = {
  quiz: '八股刷题',
  qa: '问答辅导',
  mock: '模拟面试',
};

/** 所有模式列表 */
export const MODE_LIST: { key: TutorMode; label: string; icon: string; description: string }[] = [
  { key: 'quiz', label: '八股刷题', icon: '📝', description: '针对高频面试题进行专项练习' },
  { key: 'qa', label: '问答辅导', icon: '💬', description: '解答前端技术疑问，深入理解原理' },
  { key: 'mock', label: '模拟面试', icon: '🎯', description: '模拟真实面试场景进行练习' },
];

/**
 * 从消息内容提取关键词生成标题
 */
function generateTitle(content: string): string {
  // 移除多余空白和换行
  let text = content.replace(/\s+/g, ' ').trim();

  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, '').trim();

  // 移除特殊字符
  text = text.replace(/[#*`|\\\-]/g, '').trim();

  // 截取前 20 个字符
  if (text.length > 20) {
    text = text.slice(0, 20) + '...';
  }

  return text || '新会话';
}

/**
 * 获取会话涉及的所有模式（去重）
 */
export function getSessionModes(session: ChatSession): TutorMode[] {
  const modes = new Set<TutorMode>();
  for (const msg of session.messages) {
    if (msg.mode) modes.add(msg.mode);
  }
  return Array.from(modes);
}

export const useChatStore = defineStore('chat', () => {
  /** 当前会话列表 — 初始化时从 IndexedDB 加载 */
  const sessions = ref<ChatSession[]>([]);

  /** 当前活跃会话 ID */
  const activeSessionId = ref<string>('');

  /** 是否已初始化 */
  const isInitialized = ref(false);

  /** 当前辅导模式 */
  const currentMode = ref<TutorMode>('qa');

  /** 上一次使用的模式（用于判断是否需要表明身份） */
  const lastUsedMode = ref<TutorMode | null>(null);

  /** 是否正在加载 */
  const isLoading = ref(false);

  /** 模式筛选（null 表示不筛选） */
  const modeFilter = ref<TutorMode | null>(null);

  /** 是否启用Agent模式（支持工具调用） */
  const useAgentMode = ref(false);

  /** 是否启用调试模式 */
  const debugMode = ref(false);

  /** 当前会话的工具调用事件 */
  const toolCallEvents = ref<ToolCallEvent[]>([]);

  /** 薄弱点列表 */
  const weakPoints = ref<WeakPoint[]>([]);

  /** 薄弱点统计 */
  const weakPointStats = ref({ total: 0, unmastered: 0, topics: [] as string[] });

  /**
   * 从 IndexedDB 加载会话数据
   */
  async function loadSessions() {
    try {
      sessions.value = await getAllSessions();
      // 不自动选择会话，保持空白状态
      isInitialized.value = true;
    } catch (error) {
      console.error('加载会话数据失败:', error);
      isInitialized.value = true;
    }
  }

  // 初始化时加载数据
  loadSessions();
  loadWeakPoints();

  /** 获取当前会话 */
  const activeSession = computed(() => {
    return sessions.value.find((s) => s.id === activeSessionId.value) || null;
  });

  /** 获取当前会话的消息列表 */
  const activeMessages = computed(() => {
    return activeSession.value?.messages || [];
  });

  /** 筛选后的会话列表 */
  const filteredSessions = computed(() => {
    let result = sessions.value;

    // 按模式筛选
    if (modeFilter.value) {
      result = result.filter((s) =>
        s.messages.some((m) => m.mode === modeFilter.value)
      );
    }

    return result;
  });

  /** 获取最后一条消息预览 */
  function getSessionPreview(session: ChatSession): string {
    const msgs = session.messages;
    if (msgs.length === 0) return '暂无消息';
    const last = msgs[msgs.length - 1];
    const prefix = last.role === 'user' ? '你：' : 'AI：';
    const text = last.content.replace(/\n/g, ' ').replace(/```[\s\S]*?```/g, '[代码]').replace(/[#*`|\\-]/g, '');
    return prefix + text.slice(0, 50) + (text.length > 50 ? '...' : '');
  }

  /** 切换当前会话 */
  function switchSession(id: string) {
    const session = sessions.value.find((s) => s.id === id);
    if (session) {
      activeSessionId.value = id;
      // 切换会话时，重置 lastUsedMode 以触发身份表明
      lastUsedMode.value = null;
    }
  }

  /** 设置当前模式 */
  function setMode(mode: TutorMode) {
    currentMode.value = mode;
  }

  /** 设置模式筛选 */
  function setModeFilter(mode: TutorMode | null) {
    modeFilter.value = mode;
  }

  /**
   * 新建会话
   * @param mode 初始模式（必填，由用户选择）
   */
  async function createSession(mode: TutorMode) {
    const session: ChatSession = {
      id: Date.now().toString(),
      title: '新会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 设置当前模式
    currentMode.value = mode;

    // 保存到 IndexedDB
    await saveSession(session);

    // 更新内存状态
    sessions.value.unshift(session);
    activeSessionId.value = session.id;
    lastUsedMode.value = null; // 重置，确保首次回复表明身份

    return session;
  }

  /**
   * 自动创建会话（当用户直接输入消息但没有活跃会话时）
   */
  async function ensureSession(): Promise<ChatSession> {
    if (activeSession.value) {
      return activeSession.value;
    }
    // 使用当前模式创建会话
    return await createSession(currentMode.value);
  }

  /** 删除会话 */
  async function deleteSession(id: string) {
    // 从 IndexedDB 删除
    await deleteSessionFromDB(id);

    // 更新内存状态
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (activeSessionId.value === id) {
      // 删除当前会话后，不自动选择其他会话
      activeSessionId.value = '';
    }
  }

  /** 删除消息 */
  async function deleteMessage(sessionId: string, messageId: string) {
    // 从 IndexedDB 删除
    await deleteMessageFromDB(messageId);

    // 更新内存状态
    const session = sessions.value.find((s) => s.id === sessionId);
    if (session) {
      session.messages = session.messages.filter((m) => m.id !== messageId);
      // 如果删除后没有消息了，重置标题
      if (session.messages.length === 0) {
        session.title = '新会话';
        await saveSession(session);
      }
    }
  }

  /** 搜索会话 */
  function searchSessions(keyword: string): ChatSession[] {
    const list = filteredSessions.value;
    if (!keyword.trim()) return list;
    const kw = keyword.toLowerCase();
    return list.filter(
      (s) =>
        s.title.toLowerCase().includes(kw) ||
        s.messages.some((m) => m.content.toLowerCase().includes(kw)),
    );
  }

  /**
   * 发送消息并流式接收 AI 回复
   * @param content 用户消息内容
   */
  async function sendMessage(content: string) {
    // 确保有活跃会话
    const session = await ensureSession();
    if (!session) return;

    // 记录当前使用的模式
    const messageMode = currentMode.value;

    // 判断是否需要表明身份
    const shouldIntroduce = lastUsedMode.value !== messageMode;
    lastUsedMode.value = messageMode;

    // 追加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      mode: messageMode,
    };
    session.messages.push(userMessage);
    session.updatedAt = Date.now();

    // 如果是第一条消息，生成标题
    if (session.messages.length === 1) {
      session.title = generateTitle(content);
    }

    // 保存用户消息到 IndexedDB
    await saveMessage({ ...userMessage, sessionId: session.id });
    await saveSession(session);

    // 创建空的 AI 消息占位
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      mode: messageMode,
    };
    session.messages.push(assistantMessage);
    isLoading.value = true;

    // 构造请求消息（不含最后的空 AI 占位）
    const requestMessages = session.messages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    // 流式调用 API
    await sendChatMessage(
      requestMessages,
      messageMode,
      shouldIntroduce, // 传递是否需要表明身份
      // onDelta: 追加内容到 AI 消息
      (delta) => {
        const msg = session.messages.find((m) => m.id === assistantMessageId);
        if (msg) msg.content += delta;
      },
      // onDone: 完成
      async () => {
        isLoading.value = false;
        // 保存 AI 消息到 IndexedDB
        const msg = session.messages.find((m) => m.id === assistantMessageId);
        if (msg) {
          await saveMessage({ ...msg, sessionId: session.id });
          await saveSession(session);
        }
      },
      // onError: 错误处理
      async (error) => {
        const msg = session.messages.find((m) => m.id === assistantMessageId);
        if (msg) {
          msg.content = `❌ ${error}`;
          // 保存错误消息到 IndexedDB
          await saveMessage({ ...msg, sessionId: session.id });
          await saveSession(session);
        }
        isLoading.value = false;
      },
    );
  }

  /**
   * 发送Agent消息（支持工具调用）
   * @param content 用户消息内容
   */
  async function sendAgentMessage(content: string) {
    // 确保有活跃会话
    const session = await ensureSession();
    if (!session) return;

    // 记录当前使用的模式
    const messageMode = currentMode.value;

    // 判断是否需要表明身份
    const shouldIntroduce = lastUsedMode.value !== messageMode;
    lastUsedMode.value = messageMode;

    // 追加用户消息（附带调试日志数组）
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      mode: messageMode,
      debugEvents: [], // 调试日志绑定到用户消息
    };
    session.messages.push(userMessage);
    session.updatedAt = Date.now();

    // 如果是第一条消息，生成标题
    if (session.messages.length === 1) {
      session.title = generateTitle(content);
    }

    // 保存用户消息到 IndexedDB
    await saveMessage({ ...userMessage, sessionId: session.id });
    await saveSession(session);

    // 创建空的 AI 消息占位
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      mode: messageMode,
    };
    session.messages.push(assistantMessage);
    isLoading.value = true;

    // 构造请求消息（不含最后的空 AI 占位）
    const requestMessages = session.messages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    // 获取薄弱点摘要（用于刷题模式和模拟面试模式）
    const weakPointsSummary = (messageMode === 'quiz' || messageMode === 'mock') 
      ? getWeakPointsSummary() 
      : undefined;

    // 流式调用 Agent API
    await sendAgentChatMessage(
      requestMessages,
      messageMode,
      shouldIntroduce,
      debugMode.value,
      // onDelta: 追加内容到 AI 消息
      (delta) => {
        const msg = session.messages.find((m) => m.id === assistantMessageId);
        if (msg) msg.content += delta;
      },
      // onDone: 完成
      async () => {
        isLoading.value = false;
        // 保存 AI 消息到 IndexedDB
        const msg = session.messages.find((m) => m.id === assistantMessageId);
        if (msg) {
          await saveMessage({ ...msg, sessionId: session.id });
          await saveSession(session);
          
          // 在刷题/面试模式下，分析AI回复提取薄弱点
          if (messageMode === 'quiz' || messageMode === 'mock') {
            const lastUserMsg = session.messages
              .filter((m) => m.role === 'user')
              .slice(-1)[0];
            
            if (lastUserMsg && msg.content) {
              // 尝试从AI回复中提取知识点和评分
              const topicMatch = msg.content.match(/【知识点】[：:]?\s*(.+?)\n/);
              const scoreMatch = msg.content.match(/(\d+)\s*\/\s*10|评分[：:]\s*(\d+)/);
              const topic = topicMatch ? topicMatch[1].trim() : '前端基础';
              
              // 如果有评分且低于7分，记录薄弱点
              if (scoreMatch) {
                await extractAndSaveWeakPoints(
                  lastUserMsg.content,
                  lastUserMsg.content, // 用户的答案
                  msg.content,
                  topic,
                  session.id,
                  messageMode as 'quiz' | 'mock'
                );
              }
            }
          }
        }
      },
      // onError: 错误处理
      async (error) => {
        const msg = session.messages.find((m) => m.id === assistantMessageId);
        if (msg) {
          msg.content = `❌ ${error}`;
          // 保存错误消息到 IndexedDB
          await saveMessage({ ...msg, sessionId: session.id });
          await saveSession(session);
        }
        isLoading.value = false;
      },
      // onDebugEvent: 调试事件处理（绑定到用户消息）
      (event) => {
        console.log('[调试模式] 收到调试事件:', event.type, event.message);
        const userMsg = session.messages.find((m) => m.id === userMessage.id);
        if (userMsg) {
          if (!userMsg.debugEvents) {
            userMsg.debugEvents = [];
          }
          // 使用展开运算符创建新数组，触发Vue响应式更新
          userMsg.debugEvents = [...userMsg.debugEvents, event];
          console.log('[调试模式] 当前事件总数:', userMsg.debugEvents.length);
          // 强制触发sessions的响应式更新
          sessions.value = [...sessions.value];
        }
      },
      weakPointsSummary,
    );
  }

  /**
   * 加载薄弱点数据
   */
  async function loadWeakPoints() {
    try {
      weakPoints.value = await getAllWeakPoints();
      weakPointStats.value = await getWeakPointStats();
    } catch (error) {
      console.error('加载薄弱点数据失败:', error);
    }
  }

  /**
   * 从AI回复中提取薄弱点并保存
   */
  async function extractAndSaveWeakPoints(
    question: string,
    userAnswer: string,
    evaluationResult: string,
    topic: string,
    sessionId: string,
    source: 'quiz' | 'mock' = 'quiz'
  ) {
    try {
      // 解析评分
      const scoreMatch = evaluationResult.match(/(\d+)\s*\/\s*10|评分[：:]\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2]) : undefined;
      
      // 如果得分低于7分，记录为薄弱点
      if (score !== undefined && score < 7) {
        const weakPoint: WeakPoint = {
          id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          topic,
          description: evaluationResult.slice(0, 200), // 截取前200字符作为描述
          question,
          userAnswer: userAnswer.slice(0, 500), // 截取前500字符
          score,
          source,
          sessionId,
          timestamp: Date.now(),
          mastered: false,
        };
        
        await saveWeakPoint(weakPoint);
        weakPoints.value.unshift(weakPoint);
        weakPointStats.value = await getWeakPointStats();
        
        console.log('[薄弱点] 已记录:', topic, '得分:', score);
      }
    } catch (error) {
      console.error('提取薄弱点失败:', error);
    }
  }

  /**
   * 标记薄弱点为已掌握
   */
  async function markAsMastered(id: string) {
    try {
      await markWeakPointMastered(id);
      const point = weakPoints.value.find((p) => p.id === id);
      if (point) {
        point.mastered = true;
      }
      weakPointStats.value = await getWeakPointStats();
    } catch (error) {
      console.error('标记薄弱点失败:', error);
    }
  }

  /**
   * 删除薄弱点
   */
  async function removeWeakPoint(id: string) {
    try {
      await deleteWeakPoint(id);
      weakPoints.value = weakPoints.value.filter((p) => p.id !== id);
      weakPointStats.value = await getWeakPointStats();
    } catch (error) {
      console.error('删除薄弱点失败:', error);
    }
  }

  /**
   * 获取未掌握的薄弱点摘要（用于注入到系统提示）
   */
  function getWeakPointsSummary(): string {
    const unmastered = weakPoints.value.filter((p) => !p.mastered);
    if (unmastered.length === 0) return '';
    
    const topics = [...new Set(unmastered.map((p) => p.topic))];
    return `\n\n## 用户薄弱点（请优先针对这些知识点出题）\n${topics.map((t) => `- ${t}`).join('\n')}`;
  }

  return {
    sessions,
    activeSessionId,
    currentMode,
    isLoading,
    isInitialized,
    modeFilter,
    activeSession,
    activeMessages,
    filteredSessions,
    getSessionPreview,
    getSessionModes,
    switchSession,
    setMode,
    setModeFilter,
    createSession,
    deleteSession,
    deleteMessage,
    searchSessions,
    sendMessage,
    loadSessions,
    clearAllData,
    // Agent相关状态和方法
    useAgentMode,
    debugMode,
    toolCallEvents,
    setUseAgentMode: (value: boolean) => { useAgentMode.value = value; },
    setDebugMode: (value: boolean) => { debugMode.value = value; },
    clearToolCallEvents: () => { toolCallEvents.value = []; },
    sendAgentMessage,
    // 薄弱点相关状态和方法
    weakPoints,
    weakPointStats,
    loadWeakPoints,
    extractAndSaveWeakPoints,
    markAsMastered,
    removeWeakPoint,
    getWeakPointsSummary,
  };
});
