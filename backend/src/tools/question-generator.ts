/**
 * 题目生成工具
 * 根据知识点生成面试题
 */

import type { ToolResult } from '../types';

/**
 * 执行题目生成
 * @param params 生成参数
 * @returns 生成结果
 */
export async function questionGenerator(params: {
  topic: string;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  count?: number;
  type?: 'conceptual' | 'coding' | 'scenario' | 'mixed';
}): Promise<ToolResult> {
  const { topic, difficulty = 'intermediate', count = 1, type = 'mixed' } = params;

  console.log(`[题目生成] 开始生成题目: "${topic}"`);
  console.log(`[题目生成] 难度: ${difficulty}, 数量: ${count}, 类型: ${type}`);

  try {
    const questions = generateQuestions(topic, difficulty, count, type);

    console.log(`[题目生成] 生成完成，共 ${questions.length} 道题`);

    return {
      success: true,
      data: {
        topic,
        difficulty,
        type,
        questions,
        totalQuestions: questions.length,
      },
    };
  } catch (error) {
    console.error('[题目生成] 生成异常:', error);
    return {
      success: false,
      error: `题目生成失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 生成题目
 * @param topic 主题
 * @param difficulty 难度
 * @param count 数量
 * @param type 类型
 * @returns 题目列表
 */
function generateQuestions(
  topic: string,
  difficulty: 'basic' | 'intermediate' | 'advanced',
  count: number,
  type: 'conceptual' | 'coding' | 'scenario' | 'mixed'
): Array<{
  id: string;
  question: string;
  type: string;
  difficulty: string;
  hints?: string[];
  keyPoints?: string[];
}> {
  const questions: Array<{
    id: string;
    question: string;
    type: string;
    difficulty: string;
    hints?: string[];
    keyPoints?: string[];
  }> = [];

  // 根据主题和类型生成题目
  for (let i = 0; i < count; i++) {
    const questionType = type === 'mixed' ? getRandomType() : type;
    const question = generateSingleQuestion(topic, difficulty, questionType, i + 1);
    questions.push(question);
  }

  return questions;
}

/**
 * 生成单个题目
 * @param topic 主题
 * @param difficulty 难度
 * @param type 类型
 * @param index 序号
 * @returns 题目
 */
function generateSingleQuestion(
  topic: string,
  difficulty: 'basic' | 'intermediate' | 'advanced',
  type: string,
  index: number
): {
  id: string;
  question: string;
  type: string;
  difficulty: string;
  hints?: string[];
  keyPoints?: string[];
} {
  const questionTemplates = getQuestionTemplates(topic);
  const template = questionTemplates[type as keyof typeof questionTemplates] || questionTemplates.conceptual;
  
  return {
    id: `q-${Date.now()}-${index}`,
    question: template.question,
    type,
    difficulty,
    hints: template.hints,
    keyPoints: template.keyPoints,
  };
}

/**
 * 获取题目模板
 * @param topic 主题
 * @returns 题目模板
 */
function getQuestionTemplates(topic: string) {
  return {
    conceptual: {
      question: `请解释 ${topic} 的核心概念和原理是什么？`,
      hints: [`可以从 ${topic} 的定义、特点、应用场景等方面回答`],
      keyPoints: [`${topic} 的定义`, `${topic} 的核心特性`, `${topic} 的应用场景`],
    },
    coding: {
      question: `请用代码实现一个简单的 ${topic} 示例，并解释关键代码。`,
      hints: ['注意代码的可读性和注释', '考虑边界情况和错误处理'],
      keyPoints: ['代码实现', '关键逻辑解释', '边界情况处理'],
    },
    scenario: {
      question: `在实际项目中，你会如何使用 ${topic}？请结合具体场景说明。`,
      hints: ['考虑实际业务场景', '说明选择的原因和优势'],
      keyPoints: ['场景描述', '技术选型理由', '实现方案'],
    },
  };
}

/**
 * 随机获取题目类型
 * @returns 题目类型
 */
function getRandomType(): 'conceptual' | 'coding' | 'scenario' {
  const types: Array<'conceptual' | 'coding' | 'scenario'> = ['conceptual', 'coding', 'scenario'];
  return types[Math.floor(Math.random() * types.length)];
}
