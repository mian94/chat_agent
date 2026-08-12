<template>
  <div class="tool-call-log">
    <div class="log-header" @click="toggleExpanded">
      <span class="log-icon">🔧</span>
      <span class="log-title">调试日志</span>
      <span class="log-count">{{ events.length }} 个事件</span>
      <span class="log-toggle">{{ expanded ? '▼' : '▶' }}</span>
    </div>
    
    <div v-show="expanded" class="log-content">
      <div 
        v-for="event in events" 
        :key="event.timestamp"
        class="log-event"
        :class="event.type"
      >
        <div class="event-header">
          <span class="event-icon">{{ getEventIcon(event.type) }}</span>
          <span class="event-time">{{ formatTime(event.timestamp) }}</span>
          <span class="event-type">{{ getEventTypeName(event.type) }}</span>
        </div>
        
        <div class="event-message">{{ event.message }}</div>
        
        <div v-if="event.toolName" class="event-detail">
          <span class="detail-label">工具：</span>
          <span class="detail-value">{{ event.toolName }}</span>
        </div>
        
        <div v-if="event.parameters && Object.keys(event.parameters).length > 0" class="event-detail">
          <span class="detail-label">参数：</span>
          <pre class="detail-json">{{ formatJSON(event.parameters) }}</pre>
        </div>
        
        <div v-if="event.debugLog" class="debug-detail">
          <div v-if="event.debugLog.duration" class="debug-item">
            <span class="debug-label">耗时：</span>
            <span class="debug-value">{{ event.debugLog.duration }}ms</span>
          </div>
          <div v-if="event.debugLog.status" class="debug-item">
            <span class="debug-label">状态：</span>
            <span class="debug-value" :class="event.debugLog.status">
              {{ getStatusText(event.debugLog.status) }}
            </span>
          </div>
          <div v-if="event.debugLog.result" class="debug-item">
            <span class="debug-label">结果：</span>
            <pre class="debug-json">{{ formatJSON(event.debugLog.result) }}</pre>
          </div>
          <div v-if="event.debugLog.error" class="debug-item error">
            <span class="debug-label">错误：</span>
            <span class="debug-value">{{ event.debugLog.error }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ToolCallEvent } from '@/types';

const props = defineProps<{
  events: ToolCallEvent[];
}>();

const expanded = ref(false);

// 监听事件数量变化，如果有新事件且当前未展开，保持当前状态
watch(
  () => props.events.length,
  (newLength, oldLength) => {
    // 如果有新事件且当前未展开，不自动展开（保持用户手动控制）
    console.log(`[调试日志] 事件数量变化: ${oldLength} -> ${newLength}`);
  }
);

const toggleExpanded = () => {
  console.log('[调试日志] 点击展开，当前状态:', expanded.value);
  expanded.value = !expanded.value;
  console.log('[调试日志] 新状态:', expanded.value);
  console.log('[调试日志] events数量:', props.events.length);
};

const getEventIcon = (type: string): string => {
  const icons: Record<string, string> = {
    tool_call: '🔧',
    tool_result: '✅',
    reflection: '🤔',
    task_plan: '📋',
  };
  return icons[type] || '📝';
};

const getEventTypeName = (type: string): string => {
  const names: Record<string, string> = {
    tool_call: '工具调用',
    tool_result: '工具结果',
    reflection: '反思判断',
    task_plan: '任务规划',
  };
  return names[type] || type;
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

const formatJSON = (obj: any): string => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

const getStatusText = (status: string): string => {
  const texts: Record<string, string> = {
    executing: '执行中',
    success: '成功',
    error: '失败',
  };
  return texts[status] || status;
};
</script>

<style scoped>
.tool-call-log {
  margin: 8px 0;
  border: 1px solid rgba(100, 100, 100, 0.2);
  border-radius: 8px;
  background: rgba(210, 190, 255, 0.15);
  min-height: 36px;
  flex-shrink: 0;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.03);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.log-header:hover {
  background: rgba(0, 0, 0, 0.05);
}

.log-icon {
  font-size: 14px;
}

.log-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.log-count {
  font-size: 11px;
  color: #999;
  margin-left: auto;
}

.log-toggle {
  font-size: 10px;
  color: #999;
}

.log-content {
  padding: 8px;
  max-height: 300px;
  overflow-y: auto;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.log-event {
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.log-event:last-child {
  margin-bottom: 0;
}

.event-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.event-icon {
  font-size: 12px;
}

.event-time {
  font-size: 10px;
  color: #999;
}

.event-type {
  font-size: 11px;
  font-weight: 600;
  color: #666;
}

.event-message {
  font-size: 12px;
  color: #333;
  margin-bottom: 4px;
}

.event-detail {
  margin-top: 4px;
  font-size: 11px;
}

.detail-label {
  color: #666;
  font-weight: 500;
}

.detail-value {
  color: #333;
}

.detail-json {
  background: rgba(0, 0, 0, 0.03);
  padding: 4px 6px;
  border-radius: 4px;
  margin-top: 2px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.debug-detail {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
}

.debug-item {
  margin-bottom: 4px;
  font-size: 11px;
}

.debug-item.error {
  color: #e74c3c;
}

.debug-label {
  color: #666;
  font-weight: 500;
}

.debug-value {
  color: #333;
}

.debug-value.success {
  color: #27ae60;
}

.debug-value.error {
  color: #e74c3c;
}

.debug-value.executing {
  color: #f39c12;
}

.debug-json {
  background: rgba(0, 0, 0, 0.03);
  padding: 4px 6px;
  border-radius: 4px;
  margin-top: 2px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;
}
</style>
