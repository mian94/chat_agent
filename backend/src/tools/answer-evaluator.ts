/**
 * 答案评估工具
 * 评估用户答案的质量并提供反馈
 */

import type { ToolResult } from '../types';

/**
 * 执行答案评估
 * @param params 评估参数
 * @returns 评估结果
 */
export async function answerEvaluator(params: {
  question: string;
  user_answer: string;
  reference_answer?: string;
  criteria?: string[];
}): Promise<ToolResult> {
  const { question, user_answer, reference_answer, criteria = ['准确性', '完整性', '深度', '实际应用'] } = params;

  console.log(`[答案评估] 开始评估答案`);
  console.log(`[答案评估] 问题: "${question.slice(0, 50)}..."`);

  try {
    // 评估答案
    const evaluation = evaluateAnswer(question, user_answer, reference_answer, criteria);

    console.log(`[答案评估] 评估完成，总分: ${evaluation.totalScore}`);

    return {
      success: true,
      data: {
        question,
        userAnswer: user_answer,
        evaluation,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    console.error('[答案评估] 评估异常:', error);
    return {
      success: false,
      error: `答案评估失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 评估答案
 * @param question 问题
 * @param userAnswer 用户答案
 * @param referenceAnswer 参考答案
 * @param criteria 评估标准
 * @returns 评估结果
 */
function evaluateAnswer(
  question: string,
  userAnswer: string,
  referenceAnswer?: string,
  criteria: string[] = ['准确性', '完整性', '深度', '实际应用']
): {
  totalScore: number;
  maxScore: number;
  criteriaScores: Array<{
    criterion: string;
    score: number;
    maxScore: number;
    feedback: string;
  }>;
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
} {
  const maxScore = 10;
  const criteriaScores: Array<{
    criterion: string;
    score: number;
    maxScore: number;
    feedback: string;
  }> = [];

  // 根据标准评估
  for (const criterion of criteria) {
    const score = evaluateCriterion(criterion, userAnswer, referenceAnswer);
    criteriaScores.push({
      criterion,
      score: score.score,
      maxScore: maxScore,
      feedback: score.feedback,
    });
  }

  // 计算总分
  const totalScore = criteriaScores.reduce((sum, item) => sum + item.score, 0) / criteriaScores.length;

  // 生成整体反馈
  const strengths = identifyStrengths(criteriaScores);
  const improvements = identifyImprovements(criteriaScores);
  const overallFeedback = generateOverallFeedback(totalScore, strengths, improvements);

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    maxScore,
    criteriaScores,
    overallFeedback,
    strengths,
    improvements,
  };
}

/**
 * 评估单个标准
 * @param criterion 标准
 * @param userAnswer 用户答案
 * @param referenceAnswer 参考答案
 * @returns 评估结果
 */
function evaluateCriterion(
  criterion: string,
  userAnswer: string,
  referenceAnswer?: string
): { score: number; feedback: string } {
  const answerLength = userAnswer.length;
  const hasCode = userAnswer.includes('```') || userAnswer.includes('function') || userAnswer.includes('const');
  const hasExamples = userAnswer.includes('例如') || userAnswer.includes('比如') || userAnswer.includes('例子');
  const hasExplanation = answerLength > 100;

  switch (criterion) {
    case '准确性':
      // 简单的准确性评估
      if (referenceAnswer) {
        // 如果有参考答案，进行简单的关键词匹配
        const keyWords = extractKeywords(referenceAnswer);
        const matchCount = keyWords.filter(word => userAnswer.includes(word)).length;
        const matchRatio = matchCount / keyWords.length;
        
        if (matchRatio > 0.8) return { score: 9, feedback: '答案准确性很高，涵盖了主要知识点' };
        if (matchRatio > 0.6) return { score: 7, feedback: '答案基本准确，但遗漏了一些关键点' };
        if (matchRatio > 0.4) return { score: 5, feedback: '答案部分准确，需要补充更多关键信息' };
        return { score: 3, feedback: '答案准确性较低，建议重新组织' };
      }
      // 没有参考答案时，基于答案长度和结构评估
      if (answerLength > 200) return { score: 7, feedback: '答案内容较为详细' };
      if (answerLength > 100) return { score: 5, feedback: '答案内容适中' };
      return { score: 3, feedback: '答案过于简略，建议展开说明' };

    case '完整性':
      // 完整性评估
      if (answerLength > 300 && hasCode && hasExamples) {
        return { score: 9, feedback: '答案非常完整，包含解释、代码和示例' };
      }
      if (answerLength > 200 && (hasCode || hasExamples)) {
        return { score: 7, feedback: '答案较为完整，有代码或示例' };
      }
      if (answerLength > 100) {
        return { score: 5, feedback: '答案基本完整，但可以补充更多细节' };
      }
      return { score: 3, feedback: '答案不够完整，建议补充更多内容' };

    case '深度':
      // 深度评估
      const hasDeepAnalysis = userAnswer.includes('原理') || userAnswer.includes('实现') || userAnswer.includes('源码');
      const hasComparison = userAnswer.includes('对比') || userAnswer.includes('区别') || userAnswer.includes('vs');
      
      if (hasDeepAnalysis && hasComparison) {
        return { score: 9, feedback: '答案深度很好，有原理分析和对比' };
      }
      if (hasDeepAnalysis || hasComparison) {
        return { score: 7, feedback: '答案有一定深度' };
      }
      if (hasExplanation) {
        return { score: 5, feedback: '答案有基本解释，但可以更深入' };
      }
      return { score: 3, feedback: '答案深度不足，建议深入分析' };

    case '实际应用':
      // 实际应用评估
      const hasPractical = userAnswer.includes('项目') || userAnswer.includes('实际') || userAnswer.includes('场景');
      const hasBestPractice = userAnswer.includes('最佳实践') || userAnswer.includes('建议') || userAnswer.includes('优化');
      
      if (hasPractical && hasBestPractice) {
        return { score: 9, feedback: '答案结合了实际项目和最佳实践' };
      }
      if (hasPractical || hasBestPractice) {
        return { score: 7, feedback: '答案有实际应用考虑' };
      }
      if (hasExamples) {
        return { score: 5, feedback: '答案有示例，但可以更贴近实际' };
      }
      return { score: 3, feedback: '答案缺乏实际应用考虑' };

    default:
      return { score: 5, feedback: '评估标准不明确' };
  }
}

/**
 * 提取关键词
 * @param text 文本
 * @returns 关键词列表
 */
function extractKeywords(text: string): string[] {
  // 简单的关键词提取
  const keywords: string[] = [];
  const commonKeywords = ['定义', '特点', '优势', '劣势', '应用', '场景', '原理', '实现', '示例', '代码'];
  
  for (const keyword of commonKeywords) {
    if (text.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords.length > 0 ? keywords : ['概念', '原理', '应用'];
}

/**
 * 识别优势
 * @param criteriaScores 评分
 * @returns 优势列表
 */
function identifyStrengths(criteriaScores: Array<{ criterion: string; score: number; feedback: string }>): string[] {
  return criteriaScores
    .filter(item => item.score >= 7)
    .map(item => item.feedback);
}

/**
 * 识别改进点
 * @param criteriaScores 评分
 * @returns 改进点列表
 */
function identifyImprovements(criteriaScores: Array<{ criterion: string; score: number; feedback: string }>): string[] {
  return criteriaScores
    .filter(item => item.score < 6)
    .map(item => item.feedback);
}

/**
 * 生成整体反馈
 * @param totalScore 总分
 * @param strengths 优势
 * @param improvements 改进点
 * @returns 整体反馈
 */
function generateOverallFeedback(totalScore: number, strengths: string[], improvements: string[]): string {
  let feedback = '';
  
  if (totalScore >= 8) {
    feedback = '优秀！答案质量很高，展现了扎实的知识基础和良好的表达能力。';
  } else if (totalScore >= 6) {
    feedback = '良好。答案基本正确，但还有提升空间。';
  } else if (totalScore >= 4) {
    feedback = '一般。答案需要进一步完善和深化。';
  } else {
    feedback = '需要改进。建议重新组织答案，确保覆盖关键点。';
  }
  
  if (strengths.length > 0) {
    feedback += ` 优势：${strengths[0]}。`;
  }
  
  if (improvements.length > 0) {
    feedback += ` 建议：${improvements[0]}。`;
  }
  
  return feedback;
}
