<template>
  <div class="glass-app">
    <!-- ═══ 左侧：会话侧边栏 ═══ -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="app-title">
          <span class="title-icon">✦</span>
          前端面试 Agent
        </h1>
        <button class="btn-new-chat" @click="showModeDialog = true">
          <el-icon><Plus /></el-icon>
          新建会话
        </button>
      </div>

      <div class="search-box">
        <el-icon class="search-icon"><Search /></el-icon>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索历史对话"
          class="search-input"
        />
      </div>

      <!-- 模式筛选 -->
      <div class="mode-filter">
        <button
          class="filter-btn"
          :class="{ active: !store.modeFilter }"
          @click="store.setModeFilter(null)"
        >
          全部
        </button>
        <button
          v-for="mode in MODE_LIST"
          :key="mode.key"
          class="filter-btn"
          :class="{ active: store.modeFilter === mode.key }"
          @click="store.setModeFilter(mode.key)"
        >
          {{ mode.label }}
        </button>
      </div>

      <div class="session-list">
        <div
          v-for="session in filteredSessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === store.activeSessionId }"
          @click="store.switchSession(session.id)"
        >
          <div class="session-info">
            <div class="session-header">
              <div class="session-title">{{ session.title }}</div>
              <div class="session-modes">
                <span
                  v-for="m in store.getSessionModes(session)"
                  :key="m"
                  class="mode-badge"
                >
                  {{ MODE_LABELS[m] }}
                </span>
              </div>
            </div>
            <div class="session-preview">{{ store.getSessionPreview(session) }}</div>
          </div>
          <button
            class="btn-session-delete"
            title="删除会话"
            @click.stop="handleDeleteSession(session.id)"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <div v-if="filteredSessions.length === 0" class="session-empty">
          <p>暂无匹配的会话</p>
        </div>
      </div>
    </aside>

    <!-- ═══ 右侧：主聊天区域 ═══ -->
    <main class="chat-main">
      <!-- 顶部栏 -->
      <header class="chat-topbar">
        <div class="topbar-left">
          <h2 class="current-title">
            {{ store.activeSession?.title || '新会话' }}
          </h2>
        </div>
        <div class="mode-tabs">
          <button
            v-for="mode in MODE_LIST"
            :key="mode.key"
            class="mode-tab"
            :class="{ active: store.currentMode === mode.key }"
            @click="handleModeSwitch(mode.key)"
          >
            {{ mode.label }}
          </button>
        </div>
        <div class="topbar-right">
          <!-- Agent模式开关 -->
          <label class="switch-label" title="启用Agent模式（支持工具调用）">
            <input 
              type="checkbox" 
              v-model="store.useAgentMode"
              @change="store.setUseAgentMode(store.useAgentMode)"
            />
            <span class="switch-text">Agent</span>
          </label>
          <!-- 调试模式开关 -->
          <label class="switch-label" title="启用调试模式（显示工具调用日志）">
            <input 
              type="checkbox" 
              v-model="store.debugMode"
              @change="store.setDebugMode(store.debugMode)"
            />
            <span class="switch-text">调试</span>
          </label>
        </div>
      </header>

      <!-- 消息滚动区 -->
      <div class="chat-messages" ref="messagesRef">
        <!-- 空状态 -->
        <div v-if="!store.activeSession || store.activeMessages.length === 0" class="empty-state">
          <div class="empty-icon">
            <span class="empty-emoji">💬</span>
          </div>
          <p class="empty-title">开始你的前端面试之旅</p>
          <p class="empty-hint">选择一种辅导模式，输入你的第一个问题</p>
          <div class="empty-suggestions">
            <span class="suggestion-tag" @click="handleSuggestionClick('Vue 响应式原理')">Vue 响应式原理</span>
            <span class="suggestion-tag" @click="handleSuggestionClick('React Fiber 架构')">React Fiber 架构</span>
            <span class="suggestion-tag" @click="handleSuggestionClick('JS 闭包与作用域')">JS 闭包与作用域</span>
            <span class="suggestion-tag" @click="handleSuggestionClick('CSS 布局与 BFC')">CSS 布局与 BFC</span>
          </div>
        </div>

        <!-- 消息列表 -->
        <template v-for="msg in store.activeMessages" :key="msg.id">
          <!-- 用户消息 -->
          <div
            v-if="msg.role === 'user'"
            class="message-row user"
          >
            <div class="message-bubble">
              <div class="message-header">
                <span v-if="msg.mode" class="mode-badge">
                  {{ MODE_LABELS[msg.mode] }}
                </span>
              </div>
              <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
              <div class="message-actions">
                <button class="action-btn" title="复制" @click="handleCopyMessage(msg.content)">
                  📋
                </button>
                <button class="action-btn" title="删除" @click="handleDeleteMessage(msg.id)">
                  🗑️
                </button>
              </div>
            </div>
          </div>
          <!-- 调试日志（在用户消息下方，AI回答之前） -->
          <ToolCallLog 
            v-if="msg.role === 'user' && store.useAgentMode && store.debugMode"
            :events="msg.debugEvents || []"
          />
          <!-- AI消息 -->
          <div
            v-if="msg.role === 'assistant'"
            class="message-row assistant"
          >
            <div class="message-bubble">
              <div class="message-header">
                <span v-if="msg.mode" class="mode-badge">
                  {{ MODE_LABELS[msg.mode] }}
                </span>
              </div>
              <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
              <div class="message-actions">
                <button class="action-btn" title="复制" @click="handleCopyMessage(msg.content)">
                  📋
                </button>
                <button class="action-btn" title="删除" @click="handleDeleteMessage(msg.id)">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- 加载动画 -->
        <div v-if="store.isLoading" class="message-row assistant">
          <div class="message-bubble typing-bubble">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>

      <!-- 底部输入区 -->
      <div class="chat-input-area">
        <div class="input-tools">
          <button class="tool-btn" title="插入代码块">
            <el-icon><CodeIcon /></el-icon>
          </button>
          <button class="tool-btn" title="上传文件">
            <el-icon><Link /></el-icon>
          </button>
        </div>
        <div class="input-box-wrapper">
          <textarea
            v-model="inputText"
            ref="inputRef"
            class="input-box"
            placeholder="输入你的问题..."
            rows="1"
            @keydown.enter.exact.prevent="handleSend"
            @input="autoResizeInput"
          ></textarea>
        </div>
        <button
          class="btn-send"
          :class="{ disabled: !inputText.trim() }"
          :disabled="!inputText.trim()"
          @click="handleSend"
          title="发送消息"
        >
          <el-icon><Promotion /></el-icon>
        </button>
      </div>
    </main>

    <!-- 模式选择弹窗 -->
    <div v-if="showModeDialog" class="mode-dialog-overlay" @click="showModeDialog = false">
      <div class="mode-dialog" @click.stop>
        <h3 class="dialog-title">选择辅导模式</h3>
        <p class="dialog-subtitle">为新会话选择一种辅导模式</p>
        <div class="mode-options">
          <button
            v-for="mode in MODE_LIST"
            :key="mode.key"
            class="mode-option"
            @click="handleCreateWithMode(mode.key)"
          >
            <span class="mode-option-icon">{{ mode.icon }}</span>
            <span class="mode-option-label">{{ mode.label }}</span>
            <span class="mode-option-desc">{{ mode.description }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, h } from 'vue'
import { Plus, Search, Close, Promotion, Link } from '@element-plus/icons-vue'
import { useChatStore, MODE_LABELS, MODE_LIST } from '@/stores/chat'
import { renderMarkdown } from '@/utils/markdown'
import { ElMessage } from 'element-plus'
import type { TutorMode } from '@/types'
import ToolCallLog from '@/components/ToolCallLog.vue'

/* ── 自定义代码图标（Element Plus 无内置 code 图标） ── */
const CodeIcon = {
  name: 'CodeIcon',
  props: { size: { type: [Number, String], default: 16 } },
  setup(props: { size: number | string }) {
    const s = typeof props.size === 'number' ? `${props.size}px` : props.size
    return () =>
      h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        width: s,
        height: s,
        innerHTML:
          '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
      })
  },
}

const store = useChatStore()

/** 监听 AI 回复内容变化，流式输出时自动滚动到底部 */
watch(
  () => store.activeMessages.at(-1)?.content,
  () => {
    if (store.isLoading) {
      nextTick(() => scrollToBottom())
    }
  },
)

/* ── 状态 ── */
const searchKeyword = ref('')
const inputText = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const showModeDialog = ref(false)

/* ── 计算属性 ── */
const filteredSessions = computed(() => {
  return store.searchSessions(searchKeyword.value)
})

/* ── 方法 ── */

/** 切换辅导模式 */
function handleModeSwitch(mode: TutorMode) {
  store.setMode(mode)
}

/** 使用指定模式创建新会话 */
async function handleCreateWithMode(mode: TutorMode) {
  await store.createSession(mode)
  showModeDialog.value = false
  searchKeyword.value = ''
  nextTick(() => scrollToBottom())
}

/** 删除会话 */
async function handleDeleteSession(id: string) {
  await store.deleteSession(id)
}

/** 删除消息 */
async function handleDeleteMessage(messageId: string) {
  if (store.activeSession) {
    await store.deleteMessage(store.activeSession.id, messageId)
  }
}

/** 复制消息内容（兼容 HTTP 非安全上下文） */
async function handleCopyMessage(content: string) {
  // 优先使用 Clipboard API（需要 HTTPS 或 localhost）
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content)
      ElMessage.success('已复制到剪贴板')
      return
    } catch {
      // API 存在但被拒绝，降级到 execCommand
    }
  }

  // 降级方案：使用隐藏 textarea + execCommand（兼容 HTTP 环境）
  try {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (success) {
      ElMessage.success('已复制到剪贴板')
    } else {
      ElMessage.error('复制失败')
    }
  } catch {
    ElMessage.error('复制失败')
  }
}

/** 点击建议标签 */
function handleSuggestionClick(text: string) {
  inputText.value = text
  nextTick(() => inputRef.value?.focus())
}

/** 发送消息 */
async function handleSend() {
  const content = inputText.value.trim()
  if (!content || store.isLoading) return

  // 清空输入框并重置高度
  inputText.value = ''
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
  })

  // 发送消息（如果没有活跃会话，会自动使用当前模式创建）
  if (store.useAgentMode) {
    await store.sendAgentMessage(content)
  } else {
    await store.sendMessage(content)
  }

  // 回复完成后滚动到底部
  nextTick(() => scrollToBottom())
}

/** 自动调整输入框高度 */
function autoResizeInput() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 150) + 'px'
}

/** 滚动到消息底部 */
function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

</script>

<style scoped>
/* ══════════════════════════════════════════════════
   玻璃拟态清新风 — 全局布局
   ══════════════════════════════════════════════════ */
.glass-app {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* ═══ 左侧侧边栏 ═══ */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  max-width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 12px;
  flex-shrink: 0;
}

/* ── 侧边栏头部 ── */
.sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-purple);
  display: flex;
  align-items: center;
  gap: 6px;
  letter-spacing: 0.5px;
}

.title-icon {
  display: inline-block;
  font-size: 20px;
  color: var(--color-accent-purple-light);
}

.btn-new-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--glass-radius-sm);
  background: var(--color-accent-gradient-btn);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px rgba(160, 120, 200, 0.3);
}

.btn-new-chat:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(160, 120, 200, 0.4);
}

.btn-new-chat:active {
  transform: translateY(0);
}

/* ── 搜索框 ── */
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius-sm);
  box-shadow: var(--glass-shadow-sm);
}

.search-icon {
  color: var(--color-text-muted);
  font-size: 16px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--color-text);
  font-family: var(--font-family);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

/* ── 模式筛选 ── */
.mode-filter {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius-sm);
}

.filter-btn {
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-family);
}

.filter-btn:hover {
  color: var(--color-text-purple);
  background: var(--glass-bg-hover);
}

.filter-btn.active {
  background: var(--color-accent-gradient);
  color: #ffffff;
}

/* ── 会话列表 ── */
.session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 2px;
}

.session-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: var(--glass-radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  background: transparent;
}

.session-item:hover {
  background: var(--glass-bg-hover);
  transform: translateX(2px);
}

.session-item.active {
  background: var(--glass-bg-active);
  box-shadow: var(--glass-shadow-sm);
}

.session-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.session-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.session-modes {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.mode-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--glass-bg-active);
  color: var(--color-text-purple);
  font-weight: 500;
  white-space: nowrap;
}

.session-preview {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.btn-session-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  margin-top: 2px;
}

.session-item:hover .btn-session-delete {
  opacity: 1;
}

.btn-session-delete:hover {
  background: rgba(255, 100, 100, 0.15);
  color: #e06060;
}

.session-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--color-text-muted);
  font-size: 13px;
}

/* ═══ 右侧主聊天区域 ═══ */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 16px 16px 0;
  min-width: 0;
  overflow: hidden;
}

/* ── 顶部栏 ── */
.chat-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  margin-bottom: 4px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow-sm);
  min-height: var(--topbar-height);
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.current-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.session-mode-badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--glass-bg-active);
  color: var(--color-text-purple);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── 模式切换标签 ── */
.mode-tabs {
  display: flex;
  gap: 4px;
  background: var(--glass-bg);
  padding: 4px;
  border-radius: var(--glass-radius-sm);
  border: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.mode-tab {
  padding: 8px 18px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  font-family: var(--font-family);
}

.mode-tab:hover {
  color: var(--color-text-purple);
  background: var(--glass-bg-hover);
}

.mode-tab.active {
  background: var(--color-accent-gradient);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(160, 120, 200, 0.3);
}

/* ── 消息滚动区 ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 空状态 ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  padding: 48px 24px;
}

.empty-emoji {
  font-size: 64px;
  display: block;
  opacity: 0.6;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.empty-hint {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.empty-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.suggestion-tag {
  padding: 6px 14px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  font-size: 13px;
  color: var(--color-text-purple);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.suggestion-tag:hover {
  background: var(--glass-bg-active);
  transform: translateY(-1px);
}

/* ── 消息气泡 ── */
.message-row {
  display: flex;
  max-width: 80%;
  animation: messageIn 0.3s ease;
}

@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-row.user {
  align-self: flex-end;
  justify-content: flex-end;
}

/* 调试日志样式（在用户消息下方，左对齐） */
:deep(.tool-call-log) {
  align-self: flex-start;
  max-width: 80%;
  min-width: 200px;
  width: fit-content;
  flex-shrink: 0;
}

.message-row.assistant {
  align-self: flex-start;
}

.message-bubble {
  padding: 12px 18px;
  border-radius: var(--bubble-radius);
  line-height: 1.65;
  font-size: 14px;
  word-break: break-word;
  position: relative;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.message-header .mode-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(160, 120, 200, 0.15);
  color: var(--color-text-purple);
  font-weight: 500;
}

.message-row.user .message-header .mode-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.message-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.message-bubble:hover .message-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: var(--glass-bg);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 14px;
}

.action-btn:hover {
  background: var(--glass-bg-active);
  transform: scale(1.1);
}

.message-row.user .message-bubble {
  background: var(--bubble-user-bg);
  color: var(--bubble-user-text);
  border-bottom-right-radius: 4px;
  box-shadow: 0 2px 12px rgba(160, 120, 200, 0.25);
}

.message-row.assistant .message-bubble {
  background: var(--bubble-assistant-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--bubble-assistant-text);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow-sm);
}

/* ── 打字动画 ── */
.typing-bubble {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 14px 20px !important;
}

.typing-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-text-muted);
  animation: typingBounce 1.4s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingBounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-6px);
  }
}

/* ── 消息内容样式（Markdown 渲染产物） ── */
.message-content :deep(strong) {
  font-weight: 600;
}

.message-content :deep(.md-h3) {
  font-size: 15px;
  font-weight: 600;
  margin: 8px 0 4px;
}

.message-content :deep(.md-h4) {
  font-size: 14px;
  font-weight: 600;
  margin: 6px 0 3px;
}

.message-content :deep(.md-li) {
  margin: 2px 0 2px 8px;
  list-style: disc inside;
}

/* ── 代码块 ── */
.message-content :deep(.code-block) {
  display: block;
  margin: 10px 0;
  padding: 14px 16px;
  background: var(--code-bg);
  color: var(--code-text);
  border-radius: var(--code-radius);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  position: relative;
}

.message-content :deep(.code-lang) {
  position: absolute;
  top: 6px;
  right: 10px;
  font-size: 11px;
  color: rgba(200, 200, 220, 0.5);
  font-family: var(--font-family);
  text-transform: uppercase;
}

.message-content :deep(.code-block code) {
  background: none;
  padding: 0;
  color: inherit;
}

/* 代码语法高亮 */
.message-content :deep(.token-keyword) {
  color: #c792ea;
}

.message-content :deep(.token-string) {
  color: #c3e88d;
}

.message-content :deep(.token-comment) {
  color: #676e95;
  font-style: italic;
}

.message-content :deep(.token-number) {
  color: #f78c6c;
}

.message-content :deep(.token-boolean) {
  color: #ff9cac;
}

.message-content :deep(.inline-code) {
  background: rgba(160, 140, 200, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
  color: var(--color-text-purple);
}

.message-row.user .message-content :deep(.inline-code) {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.message-row.user .message-content :deep(.code-block) {
  background: rgba(0, 0, 0, 0.25);
}

/* ── 表格 ── */
.message-content :deep(.md-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.message-content :deep(.md-table th),
.message-content :deep(.md-table td) {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid rgba(180, 160, 210, 0.25);
}

.message-content :deep(.md-table th) {
  background: rgba(180, 160, 210, 0.2);
  font-weight: 600;
}

.message-content :deep(.md-table td) {
  background: rgba(255, 255, 255, 0.3);
}

.message-row.user .message-content :deep(.md-table th) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.2);
}

.message-row.user .message-content :deep(.md-table td) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}

/* ═══ 底部输入区 ═══ */
.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 16px;
  margin-top: 8px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow-sm);
  flex-shrink: 0;
}

.input-tools {
  display: flex;
  gap: 2px;
  padding-bottom: 4px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-purple);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tool-btn:hover {
  background: var(--glass-bg-active);
}

.input-box-wrapper {
  flex: 1;
  min-width: 0;
}

.input-box {
  width: 100%;
  padding: 10px 14px;
  border: none;
  outline: none;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--glass-radius-sm);
  font-size: 14px;
  font-family: var(--font-family);
  color: var(--color-text);
  resize: none;
  line-height: 1.5;
  transition: all var(--transition-fast);
}

.input-box::placeholder {
  color: var(--color-text-muted);
}

.input-box:focus {
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 0 3px rgba(180, 140, 220, 0.2);
}

.btn-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: var(--color-accent-gradient-btn);
  color: #ffffff;
  font-size: 18px;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 4px 14px rgba(160, 120, 200, 0.35);
  flex-shrink: 0;
}

.btn-send:hover:not(.disabled) {
  transform: scale(1.08);
  box-shadow: 0 6px 20px rgba(160, 120, 200, 0.5);
}

.btn-send:active:not(.disabled) {
  transform: scale(0.95);
}

.btn-send.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* ═══ 模式选择弹窗 ═══ */
.mode-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.mode-dialog {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  padding: 32px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
  min-width: 360px;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.dialog-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
  text-align: center;
}

.dialog-subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-bottom: 24px;
  text-align: center;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius-sm);
  background: var(--glass-bg);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
  font-family: var(--font-family);
}

.mode-option:hover {
  background: var(--glass-bg-active);
  transform: translateX(4px);
  box-shadow: var(--glass-shadow-sm);
}

.mode-option-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.mode-option-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.mode-option-desc {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* Agent模式和调试模式开关样式 */
.topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.switch-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary, #409eff);
}

.switch-text {
  font-size: 12px;
  color: var(--color-text-muted, #666);
  font-weight: 500;
}

.switch-label:hover .switch-text {
  color: var(--color-text, #333);
}

/* ══════════════════════════════════════════════════
   响应式布局
   ══════════════════════════════════════════════════ */

/* 平板设备 (768px - 1024px) */
@media (max-width: 1024px) {
  :root {
    --sidebar-width: 240px;
  }
  
  .sidebar {
    padding: 12px;
  }
  
  .app-title {
    font-size: 16px;
  }
  
  .mode-tab {
    padding: 6px 12px;
    font-size: 12px;
  }
}

/* 移动端 (< 768px) */
@media (max-width: 768px) {
  .glass-app {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    min-width: 100%;
    height: auto;
    max-height: 50vh;
    padding: 12px;
    gap: 8px;
    border-right: none;
    border-bottom: 1px solid var(--glass-border);
  }
  
  .sidebar-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  
  .app-title {
    font-size: 16px;
  }
  
  .btn-new-chat {
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .mode-filter {
    flex-wrap: wrap;
  }
  
  .filter-btn {
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .session-list {
    max-height: 200px;
  }
  
  .chat-main {
    height: auto;
    min-height: 50vh;
    padding: 12px;
  }
  
  .chat-topbar {
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
  }
  
  .topbar-left {
    width: 100%;
    justify-content: space-between;
  }
  
  .current-title {
    font-size: 14px;
    max-width: 200px;
  }
  
  .mode-tabs {
    width: 100%;
    justify-content: center;
  }
  
  .mode-tab {
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .topbar-right {
    width: 100%;
    justify-content: center;
  }
  
  .chat-messages {
    padding: 12px 8px;
    gap: 12px;
  }
  
  .message-bubble {
    max-width: 95%;
  }
  
  .chat-input-area {
    padding: 8px 12px;
  }
  
  .input-wrapper {
    padding: 10px;
  }
  
  .input-field {
    font-size: 14px;
  }
  
  .send-btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}

/* 超小屏幕 (< 480px) */
@media (max-width: 480px) {
  .sidebar {
    max-height: 40vh;
    padding: 8px;
  }
  
  .search-box {
    padding: 8px 10px;
  }
  
  .session-item {
    padding: 8px 10px;
  }
  
  .chat-main {
    padding: 8px;
  }
  
  .chat-topbar {
    padding: 8px;
  }
  
  .mode-tab {
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .chat-messages {
    padding: 8px;
  }
  
  .message-bubble {
    padding: 10px 12px;
  }
  
  .chat-input-area {
    padding: 6px 8px;
  }
}

</style>
