/**
 * IndexedDB 数据库工具类
 * 使用 idb 库封装，提供类型安全的数据库操作
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { ChatSession, ChatMessage, TutorMode } from '@/types';

/** 会话元数据（不含消息） */
export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** 数据库 Schema 定义 */
interface ChatDB {
  sessions: {
    key: string;
    value: SessionMeta;
  };
  messages: {
    key: string;
    value: ChatMessage & { sessionId: string };
    indexes: { 'by-session': string };
  };
}

/** 数据库名称和版本 */
const DB_NAME = 'chat-agent';
const DB_VERSION = 2;

/** 数据库实例（单例模式） */
let dbInstance: Promise<IDBPDatabase<ChatDB>> | null = null;

/**
 * 获取数据库实例（单例）
 */
export function getDB(): Promise<IDBPDatabase<ChatDB>> {
  if (!dbInstance) {
    dbInstance = openDB<ChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // 版本 1：创建基础表结构
        if (oldVersion < 1) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-updatedAt', 'updatedAt');

          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by-session', 'sessionId');
        }

        // 版本 2：会话不再有固定模式，模式移至消息级别
        // 数据迁移在应用层处理（兼容旧数据）
      },
    });
  }
  return dbInstance;
}

// ============================================================
// 会话操作
// ============================================================

/**
 * 获取所有会话（按更新时间倒序，包含消息）
 */
export async function getAllSessions(): Promise<ChatSession[]> {
  const db = await getDB();
  const sessionMetas = await db.getAll('sessions');
  
  // 按更新时间倒序
  sessionMetas.sort((a, b) => b.updatedAt - a.updatedAt);
  
  // 加载每个会话的消息
  const sessions: ChatSession[] = [];
  for (const meta of sessionMetas) {
    const messages = await getMessagesBySession(meta.id);
    sessions.push({ ...meta, messages });
  }
  
  return sessions;
}

/**
 * 获取单个会话
 */
export async function getSession(id: string): Promise<ChatSession | undefined> {
  const db = await getDB();
  return db.get('sessions', id);
}

/**
 * 保存会话元数据（新增或更新）
 */
export async function saveSessionMeta(meta: SessionMeta): Promise<void> {
  const db = await getDB();
  await db.put('sessions', meta);
}

/**
 * 保存完整会话（元数据 + 消息）
 */
export async function saveSession(session: ChatSession): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'messages'], 'readwrite');
  
  // 保存会话元数据
  const { messages, ...meta } = session;
  await tx.objectStore('sessions').put(meta);
  
  // 保存消息
  for (const msg of messages) {
    await tx.objectStore('messages').put({ ...msg, sessionId: session.id });
  }
  
  await tx.done;
}

/**
 * 删除会话及其所有消息
 */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'messages'], 'readwrite');

  // 删除会话
  await tx.objectStore('sessions').delete(id);

  // 删除该会话的所有消息
  const messageStore = tx.objectStore('messages');
  const index = messageStore.index('by-session');
  let cursor = await index.openCursor(IDBKeyRange.only(id));

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

// ============================================================
// 消息操作
// ============================================================

/**
 * 获取指定会话的所有消息（按时间戳排序）
 */
export async function getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
  const db = await getDB();
  const index = db.transaction('messages').store.index('by-session');
  const messages = await index.getAll(sessionId);
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * 保存消息（新增或更新）
 */
export async function saveMessage(message: ChatMessage & { sessionId: string }): Promise<void> {
  const db = await getDB();
  await db.put('messages', message);
}

/**
 * 批量保存消息
 */
export async function saveMessages(messages: (ChatMessage & { sessionId: string })[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('messages', 'readwrite');
  await Promise.all(messages.map((msg) => tx.store.put(msg)));
  await tx.done;
}

/**
 * 删除消息
 */
export async function deleteMessage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('messages', id);
}

/**
 * 删除指定会话的所有消息
 */
export async function deleteMessagesBySession(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('messages', 'readwrite');
  const index = tx.store.index('by-session');
  let cursor = await index.openCursor(IDBKeyRange.only(sessionId));

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

// ============================================================
// 数据迁移（从 Mock 数据迁移到 IndexedDB）
// ============================================================

/**
 * 检查数据库是否为空
 */
export async function isDBEmpty(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count('sessions');
  return count === 0;
}

/**
 * 清空所有数据
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sessions', 'messages'], 'readwrite');
  await tx.objectStore('sessions').clear();
  await tx.objectStore('messages').clear();
  await tx.done;
}
