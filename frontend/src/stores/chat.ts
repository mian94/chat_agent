import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ChatSession, ChatMessage, TutorMode } from '@/types';

/** 模式显示名称映射 */
export const MODE_LABELS: Record<TutorMode, string> = {
  quiz: '八股刷题',
  qa: '问答辅导',
  mock: '模拟面试',
};

/** 所有模式列表 */
export const MODE_LIST: { key: TutorMode; label: string }[] = [
  { key: 'quiz', label: '八股刷题' },
  { key: 'qa', label: '问答辅导' },
  { key: 'mock', label: '模拟面试' },
];

/** 生成 Mock 会话数据 */
function createMockSessions(): ChatSession[] {
  const now = Date.now();
  return [
    {
      id: 'mock-1',
      title: 'Vue 响应式原理深入',
      mode: 'qa',
      messages: [
        {
          id: 'msg-1-1',
          role: 'user',
          content: 'Vue3 的响应式原理和 Vue2 有什么本质区别？',
          timestamp: now - 3600000,
        },
        {
          id: 'msg-1-2',
          role: 'assistant',
          content: 'Vue3 使用 **Proxy** 替代了 Vue2 的 `Object.defineProperty`，这是最核心的变化。\n\n### 主要区别：\n\n| 特性 | Vue2 | Vue3 |\n|------|------|------|\n| 底层机制 | Object.defineProperty | Proxy |\n| 数组监听 | 需要重写数组方法 | 原生支持 |\n| 新增属性 | 需要 Vue.set | 自动追踪 |\n| 性能 | 递归遍历所有属性 | 惰性代理，按需追踪 |\n\n```js\n// Vue3 响应式核心示例\nfunction reactive(target) {\n  return new Proxy(target, {\n    get(target, key, receiver) {\n      track(target, key);\n      return Reflect.get(target, key, receiver);\n    },\n    set(target, key, value, receiver) {\n      const result = Reflect.set(target, key, value, receiver);\n      trigger(target, key);\n      return result;\n    }\n  });\n}\n```\n\nProxy 的优势在于可以拦截更多操作，包括属性读取、赋值、枚举、函数调用等 13 种行为。',
          timestamp: now - 3500000,
        },
      ],
      createdAt: now - 3600000,
      updatedAt: now - 3500000,
    },
    {
      id: 'mock-2',
      title: 'React Fiber 架构',
      mode: 'quiz',
      messages: [
        {
          id: 'msg-2-1',
          role: 'assistant',
          content: '📝 **刷题模式**\n\n请回答以下问题：\n\n**React Fiber 架构的核心目标是什么？它与之前的 Stack Reconciler 有何本质区别？**\n\n提示：可以从调度机制、任务优先级、可中断渲染等角度思考。',
          timestamp: now - 7200000,
        },
        {
          id: 'msg-2-2',
          role: 'user',
          content: 'Fiber 的核心目标是实现可中断的异步渲染。之前 Stack Reconciler 是同步递归的，一旦开始就不能中断，会导致主线程阻塞。Fiber 通过链表结构将渲染任务拆分成小的工作单元，配合 requestIdleCallback 实现分片执行，高优先级任务可以打断低优先级任务。',
          timestamp: now - 7100000,
        },
        {
          id: 'msg-2-3',
          role: 'assistant',
          content: '✅ 回答得很好！评分：**8.5/10**\n\n你的回答抓住了核心要点：\n- ✅ 正确指出了可中断异步渲染\n- ✅ 提到了链表结构和任务拆分\n- ✅ 提及了优先级调度\n\n**补充建议：**\n可以进一步提到 Fiber 的双缓冲机制（current 和 workInProgress 树），以及 Scheduler 包在其中的角色。这是面试中的加分项！',
          timestamp: now - 7000000,
        },
      ],
      createdAt: now - 7200000,
      updatedAt: now - 7000000,
    },
    {
      id: 'mock-3',
      title: '模拟面试 - 前端基础',
      mode: 'mock',
      messages: [
        {
          id: 'msg-3-1',
          role: 'assistant',
          content: '🎯 **模拟面试开始**\n\n你好！我是今天的面试官。本次面试主要考察前端基础知识，预计持续 15-20 分钟。请先做一个简短的自我介绍吧。',
          timestamp: now - 10800000,
        },
        {
          id: 'msg-3-2',
          role: 'user',
          content: '面试官你好，我是一名有3年经验的前端开发工程师，主要技术栈是 Vue 和 React。参与过多个中后台管理系统的开发，对前端工程化和性能优化有一定实践经验。',
          timestamp: now - 10700000,
        },
        {
          id: 'msg-3-3',
          role: 'assistant',
          content: '好的，感谢你的介绍。那我们直接进入正题。\n\n**第一个问题：** 请说明一下浏览器从输入 URL 到页面渲染的完整过程。尽量详细一些。',
          timestamp: now - 10600000,
        },
        {
          id: 'msg-3-4',
          role: 'user',
          content: '大致流程是：DNS 解析 → TCP 三次握手 → 发送 HTTP 请求 → 服务器响应 → 浏览器解析 HTML 构建 DOM 树 → 解析 CSS 构建 CSSOM 树 → 合并成渲染树 → 布局计算 → 绘制。如果遇到 script 标签会阻塞解析。',
          timestamp: now - 10500000,
        },
      ],
      createdAt: now - 10800000,
      updatedAt: now - 10500000,
    },
    {
      id: 'mock-4',
      title: 'JavaScript 闭包与作用域',
      mode: 'qa',
      messages: [
        {
          id: 'msg-4-1',
          role: 'user',
          content: '能详细说说闭包在实际开发中的应用场景吗？',
          timestamp: now - 86400000,
        },
        {
          id: 'msg-4-2',
          role: 'assistant',
          content: '闭包在前端开发中应用非常广泛，以下是几个典型场景：\n\n**1. 数据私有化（模块模式）**\n```js\nfunction createCounter() {\n  let count = 0;\n  return {\n    increment: () => ++count,\n    decrement: () => --count,\n    getValue: () => count\n  };\n}\n```\n\n**2. 函数柯里化**\n```js\nconst add = a => b => a + b;\nconst add5 = add(5);\nconsole.log(add5(3)); // 8\n```\n\n**3. 防抖节流中的状态保持**\n**4. React Hooks 的底层原理**（useState 本质上就是闭包）\n\n需要注意的是，闭包可能导致内存泄漏，要及时清理不再使用的大对象引用。',
          timestamp: now - 86300000,
        },
      ],
      createdAt: now - 86400000,
      updatedAt: now - 86300000,
    },
    {
      id: 'mock-5',
      title: 'CSS 布局与 BFC',
      mode: 'quiz',
      messages: [
        {
          id: 'msg-5-1',
          role: 'assistant',
          content: '📝 **每日一题**\n\n**题目：** 请解释什么是 BFC（块级格式化上下文），以及如何创建 BFC？列举至少 3 种创建方式并说明其常见应用场景。',
          timestamp: now - 172800000,
        },
      ],
      createdAt: now - 172800000,
      updatedAt: now - 172800000,
    },
  ];
}

export const useChatStore = defineStore('chat', () => {
  /** 当前会话列表 — 初始化时加载 Mock 数据 */
  const sessions = ref<ChatSession[]>(createMockSessions());

  /** 当前活跃会话 ID */
  const activeSessionId = ref<string>(sessions.value[0]?.id || '');

  /** 当前辅导模式 */
  const currentMode = ref<TutorMode>('qa');

  /** 是否正在加载 */
  const isLoading = ref(false);

  /** 获取当前会话 */
  const activeSession = computed(() => {
    return sessions.value.find((s) => s.id === activeSessionId.value) || null;
  });

  /** 获取当前会话的消息列表 */
  const activeMessages = computed(() => {
    return activeSession.value?.messages || [];
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
      currentMode.value = session.mode;
    }
  }

  /** 设置当前模式 */
  function setMode(mode: TutorMode) {
    currentMode.value = mode;
  }

  /** 新建会话 */
  function createSession(mode?: TutorMode) {
    const m = mode || currentMode.value;
    const session: ChatSession = {
      id: Date.now().toString(),
      title: `${MODE_LABELS[m]} - ${new Date().toLocaleDateString('zh-CN')}`,
      mode: m,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessions.value.unshift(session);
    activeSessionId.value = session.id;
    return session;
  }

  /** 删除会话 */
  function deleteSession(id: string) {
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value[0]?.id || '';
    }
  }

  /** 搜索会话 */
  function searchSessions(keyword: string): ChatSession[] {
    if (!keyword.trim()) return sessions.value;
    const kw = keyword.toLowerCase();
    return sessions.value.filter(
      (s) =>
        s.title.toLowerCase().includes(kw) ||
        s.messages.some((m) => m.content.toLowerCase().includes(kw)),
    );
  }

  return {
    sessions,
    activeSessionId,
    currentMode,
    isLoading,
    activeSession,
    activeMessages,
    getSessionPreview,
    switchSession,
    setMode,
    createSession,
    deleteSession,
    searchSessions,
  };
});
