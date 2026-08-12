/**
 * 联网搜索工具
 * 使用智谱AI Web Search API（搜狗搜索引擎）搜索前端面试题和技术文档
 */

import type { ToolResult } from '../types';

/** 智谱AI Web Search API 响应接口 */
interface ZhipuSearchResponse {
  search_result?: Array<{
    title: string;
    link: string;
    content: string;
    media?: string;
  }>;
}

/**
 * 执行网络搜索
 * @param params 搜索参数
 * @returns 搜索结果
 */
export async function webSearch(params: {
  query: string;
  count?: number;
}): Promise<ToolResult> {
  const { query, count = 5 } = params;
  const apiKey = process.env.ZHIPU_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'ZHIPU_API_KEY 未配置，请在 .env 文件中设置',
    };
  }

  try {
    console.log(`[联网搜索] 开始搜索: "${query}"`);
    
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/web_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        search_query: query,
        search_engine: 'search_pro_sogou',
        count: Math.min(count, 10),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[联网搜索] API错误 (${response.status}):`, errorText);
      return {
        success: false,
        error: `智谱AI搜索API错误 (${response.status}): ${errorText}`,
      };
    }

    const data: ZhipuSearchResponse = await response.json();
    const searchResults = data.search_result || [];

    console.log(`[联网搜索] 找到 ${searchResults.length} 个结果`);

    // 转换为统一的返回格式（保持与原来Bing API相同的数据结构）
    const results = searchResults.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.content,
      date: item.media,
    }));

    return {
      success: true,
      data: {
        query,
        results,
        totalResults: results.length,
      },
    };
  } catch (error) {
    console.error('[联网搜索] 搜索异常:', error);
    return {
      success: false,
      error: `搜索失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
