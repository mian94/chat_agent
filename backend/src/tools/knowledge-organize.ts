/**
 * 知识整理工具
 * 将零散信息结构化整理
 */

import type { ToolResult } from '../types';

/**
 * 执行知识整理
 * @param params 整理参数
 * @returns 整理结果
 */
export async function knowledgeOrganize(params: {
  content: string;
  topic: string;
  format?: 'outline' | 'mindmap' | 'faq' | 'comparison';
}): Promise<ToolResult> {
  const { content, topic, format = 'outline' } = params;

  console.log(`[知识整理] 开始整理: "${topic}"`);
  console.log(`[知识整理] 整理格式: ${format}`);

  try {
    // 根据格式生成结构化内容
    const organized = generateOrganizedContent(content, topic, format);

    console.log(`[知识整理] 整理完成`);

    return {
      success: true,
      data: {
        topic,
        format,
        content: organized,
        wordCount: organized.length,
      },
    };
  } catch (error) {
    console.error('[知识整理] 整理异常:', error);
    return {
      success: false,
      error: `知识整理失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 根据格式生成结构化内容
 * @param content 原始内容
 * @param topic 主题
 * @param format 格式
 * @returns 结构化内容
 */
function generateOrganizedContent(
  content: string,
  topic: string,
  format: 'outline' | 'mindmap' | 'faq' | 'comparison'
): string {
  switch (format) {
    case 'outline':
      return generateOutline(content, topic);
    case 'mindmap':
      return generateMindmap(content, topic);
    case 'faq':
      return generateFAQ(content, topic);
    case 'comparison':
      return generateComparison(content, topic);
    default:
      return generateOutline(content, topic);
  }
}

/**
 * 生成大纲格式
 * @param content 原始内容
 * @param topic 主题
 * @returns 大纲内容
 */
function generateOutline(content: string, topic: string): string {
  // 尝试从内容中提取URL信息（格式：标题\nURL\n摘要）
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls: string[] = [];
  let match;
  
  // 提取所有URL
  while ((match = urlPattern.exec(content)) !== null) {
    urls.push(match[0]);
  }
  
  // 简单的大纲生成逻辑
  const lines = content.split('\n').filter(line => line.trim());
  const outline: string[] = [`# ${topic} 知识大纲\n`];
  
  let currentSection = '';
  let sectionIndex = 0;
  let urlIndex = 0;
  
  for (const line of lines) {
    // 跳过URL行
    if (line.match(/^https?:\/\//)) continue;
    
    // 检测是否是标题（简单的启发式判断）
    if (line.includes('：') || line.includes(':') || line.startsWith('#')) {
      sectionIndex++;
      currentSection = line.replace(/^[#\s]+/, '').trim();
      outline.push(`## ${sectionIndex}. ${currentSection}\n`);
    } else if (line.trim()) {
      // 如果有对应的URL，添加为参考链接
      if (urlIndex < urls.length) {
        outline.push(`- ${line.trim()}\n`);
        outline.push(`  参考链接：${urls[urlIndex]}\n`);
        urlIndex++;
      } else {
        outline.push(`- ${line.trim()}\n`);
      }
    }
  }
  
  // 如果没有检测到明显结构，生成通用大纲
  if (sectionIndex === 0) {
    outline.push(`## 1. 概述\n`);
    outline.push(`- ${topic} 的基本概念和定义\n`);
    outline.push(`## 2. 核心要点\n`);
    outline.push(`- ${topic} 的关键特性和优势\n`);
    outline.push(`## 3. 实际应用\n`);
    outline.push(`- ${topic} 的使用场景和最佳实践\n`);
    outline.push(`## 4. 常见问题\n`);
    outline.push(`- ${topic} 的常见问题和解决方案\n`);
  }
  
  // 在末尾添加完整的参考链接列表
  if (urls.length > 0) {
    outline.push(`\n## 参考链接\n`);
    for (const url of urls) {
      outline.push(`- ${url}\n`);
    }
  }
  
  return outline.join('');
}

/**
 * 生成思维导图格式
 * @param content 原始内容
 * @param topic 主题
 * @returns 思维导图内容
 */
function generateMindmap(content: string, topic: string): string {
  const lines = content.split('\n').filter(line => line.trim());
  const mindmap: string[] = [`${topic}\n`];
  
  let indent = 1;
  const indentStr = '  ';
  
  for (const line of lines.slice(0, 10)) { // 限制数量
    if (line.includes('：') || line.includes(':')) {
      mindmap.push(`${indentStr.repeat(indent)}├── ${line.trim()}\n`);
      indent++;
    } else if (line.trim()) {
      mindmap.push(`${indentStr.repeat(indent)}└── ${line.trim()}\n`);
    }
  }
  
  return mindmap.join('');
}

/**
 * 生成FAQ格式
 * @param content 原始内容
 * @param topic 主题
 * @returns FAQ内容
 */
function generateFAQ(content: string, topic: string): string {
  const faq: string[] = [`# ${topic} 常见问题\n`];
  
  // 生成一些通用FAQ
  faq.push(`## Q1: 什么是 ${topic}？\n`);
  faq.push(`A1: ${topic} 是前端开发中的重要概念，具体内容请参考相关文档。\n\n`);
  
  faq.push(`## Q2: ${topic} 有哪些核心特性？\n`);
  faq.push(`A2: ${topic} 的核心特性包括性能优化、代码复用、开发效率等方面。\n\n`);
  
  faq.push(`## Q3: 如何学习 ${topic}？\n`);
  faq.push(`A3: 建议从官方文档开始，结合实际项目练习，逐步深入理解。\n\n`);
  
  faq.push(`## Q4: ${topic} 的常见应用场景有哪些？\n`);
  faq.push(`A4: ${topic} 广泛应用于现代前端开发中，特别是在大型项目和复杂应用中。\n\n`);
  
  return faq.join('');
}

/**
 * 生成对比格式
 * @param content 原始内容
 * @param topic 主题
 * @returns 对比内容
 */
function generateComparison(content: string, topic: string): string {
  const comparison: string[] = [`# ${topic} 对比分析\n`];
  
  comparison.push(`| 特性 | 说明 | 优势 | 劣势 |\n`);
  comparison.push(`|------|------|------|------|\n`);
  comparison.push(`| 性能 | 执行效率 | 快速 | 资源消耗 |\n`);
  comparison.push(`| 易用性 | 学习曲线 | 简单 | 功能限制 |\n`);
  comparison.push(`| 扩展性 | 可扩展性 | 灵活 | 复杂度 |\n`);
  comparison.push(`| 生态 | 社区支持 | 丰富 | 碎片化 |\n`);
  
  return comparison.join('');
}
