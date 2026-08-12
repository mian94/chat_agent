/**
 * 任务规划工具
 * 将复杂任务拆分为多个可执行步骤
 */

import type { ToolResult } from '../types';

/**
 * 执行任务规划
 * @param params 任务参数
 * @returns 规划结果
 */
export async function taskPlanner(params: {
  task_description: string;
  depth?: 'basic' | 'comprehensive' | 'deep';
}): Promise<ToolResult> {
  const { task_description, depth = 'comprehensive' } = params;

  console.log(`[任务规划] 开始规划任务: "${task_description}"`);
  console.log(`[任务规划] 规划深度: ${depth}`);

  try {
    // 根据深度确定步骤数量
    const stepCounts = {
      basic: 3,
      comprehensive: 5,
      deep: 7,
    };
    const maxSteps = stepCounts[depth];

    // 分析任务类型，生成步骤
    const steps = generateTaskSteps(task_description, maxSteps);

    console.log(`[任务规划] 生成 ${steps.length} 个步骤`);

    return {
      success: true,
      data: {
        task: task_description,
        depth,
        steps,
        totalSteps: steps.length,
        estimatedTime: `${steps.length * 2}-${steps.length * 3} 分钟`,
      },
    };
  } catch (error) {
    console.error('[任务规划] 规划异常:', error);
    return {
      success: false,
      error: `任务规划失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 根据任务描述生成步骤
 * @param taskDescription 任务描述
 * @param maxSteps 最大步骤数
 * @returns 步骤列表
 */
function generateTaskSteps(taskDescription: string, maxSteps: number): Array<{
  step: number;
  title: string;
  description: string;
  tool?: string;
  estimatedTime: string;
}> {
  const taskLower = taskDescription.toLowerCase();
  const steps: Array<{
    step: number;
    title: string;
    description: string;
    tool?: string;
    estimatedTime: string;
  }> = [];

  // 根据任务关键词生成相应步骤
  if (taskLower.includes('面试') || taskLower.includes('准备')) {
    steps.push({
      step: 1,
      title: '搜索最新面试题',
      description: `搜索"${extractTopic(taskDescription)}相关的最新面试题和高频考点`,
      tool: 'web_search',
      estimatedTime: '1-2 分钟',
    });
    steps.push({
      step: 2,
      title: '整理核心知识点',
      description: '将搜索到的面试题和知识点进行结构化整理',
      tool: 'knowledge_organize',
      estimatedTime: '2-3 分钟',
    });
    steps.push({
      step: 3,
      title: '生成练习题',
      description: '根据整理的知识点生成针对性练习题',
      tool: 'question_generator',
      estimatedTime: '1-2 分钟',
    });
  } else if (taskLower.includes('学习') || taskLower.includes('理解')) {
    steps.push({
      step: 1,
      title: '搜索学习资料',
      description: `搜索"${extractTopic(taskDescription)}相关的学习资料和教程`,
      tool: 'web_search',
      estimatedTime: '1-2 分钟',
    });
    steps.push({
      step: 2,
      title: '整理学习大纲',
      description: '将学习资料整理成结构化的大纲',
      tool: 'knowledge_organize',
      estimatedTime: '2-3 分钟',
    });
  } else if (taskLower.includes('练习') || taskLower.includes('刷题')) {
    steps.push({
      step: 1,
      title: '搜索练习题',
      description: `搜索"${extractTopic(taskDescription)}相关的练习题和答案`,
      tool: 'web_search',
      estimatedTime: '1-2 分钟',
    });
    steps.push({
      step: 2,
      title: '生成模拟题',
      description: '根据搜索结果生成模拟练习题',
      tool: 'question_generator',
      estimatedTime: '1-2 分钟',
    });
  } else {
    // 通用任务步骤
    steps.push({
      step: 1,
      title: '分析任务需求',
      description: '分析任务的具体需求和目标',
      estimatedTime: '1 分钟',
    });
    steps.push({
      step: 2,
      title: '搜索相关信息',
      description: `搜索与"${extractTopic(taskDescription)}"相关的信息`,
      tool: 'web_search',
      estimatedTime: '1-2 分钟',
    });
    steps.push({
      step: 3,
      title: '整理信息',
      description: '将搜索到的信息进行整理和归纳',
      tool: 'knowledge_organize',
      estimatedTime: '2-3 分钟',
    });
  }

  // 根据深度添加更多步骤
  if (maxSteps >= 5 && steps.length < 5) {
    steps.push({
      step: steps.length + 1,
      title: '深入分析',
      description: '对整理的内容进行深入分析和总结',
      estimatedTime: '2-3 分钟',
    });
  }

  if (maxSteps >= 7 && steps.length < 7) {
    steps.push({
      step: steps.length + 1,
      title: '生成学习计划',
      description: '根据分析结果生成个性化的学习计划',
      estimatedTime: '1-2 分钟',
    });
  }

  return steps.slice(0, maxSteps);
}

/**
 * 从任务描述中提取主题
 * @param taskDescription 任务描述
 * @returns 主题
 */
function extractTopic(taskDescription: string): string {
  // 简单的主题提取逻辑
  const keywords = ['Vue', 'React', 'JavaScript', 'TypeScript', 'CSS', 'HTML', 'Node.js', 'Webpack', 'Vite'];
  
  for (const keyword of keywords) {
    if (taskDescription.includes(keyword)) {
      return keyword;
    }
  }
  
  // 如果没有匹配到关键词，返回任务描述的前20个字符
  return taskDescription.slice(0, 20);
}
