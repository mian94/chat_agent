/**
 * Markdown 渲染工具
 * 使用 marked + highlight.js 实现专业级渲染
 */

import { marked } from 'marked';
import hljs from 'highlight.js';

// 导入 highlight.js 样式
import 'highlight.js/styles/atom-one-dark.css';

/**
 * 将 Token 转换为 HTML 字符串
 * 通过 marked.parser 来正确渲染行内语法（代码、加粗等）
 */
function tokensToHtml(tokens: any): string {
  if (typeof tokens === 'string') return tokens;
  if (!tokens) return '';
  
  // 如果是数组，递归处理
  if (Array.isArray(tokens)) {
    return tokens.map(tokensToHtml).join('');
  }
  
  // 如果是 Token 对象
  if (tokens.type) {
    // 根据 token类型来渲染
    switch (tokens.type) {
      case 'text':
        return tokensToHtml(tokens.tokens || tokens.text || '');
      case 'codespan':
        return `<code class="inline-code">${tokens.text || ''}</code>`;
      case 'strong':
        return `<strong>${tokensToHtml(tokens.tokens || tokens.text || '')}</strong>`;
      case 'em':
        return `<em>${tokensToHtml(tokens.tokens || tokens.text || '')}</em>`;
      case 'link':
        return `<a href="${tokens.href || '#'}" target="_blank" rel="noopener noreferrer">${tokensToHtml(tokens.tokens || tokens.text || '')}</a>`;
      case 'escape':
        return tokens.text || '';
      default:
        // 对于其他类型，尝试递归处理 tokens
        if (tokens.tokens) return tokensToHtml(tokens.tokens);
        if (tokens.text) return tokens.text;
        return '';
    }
  }
  
  return String(tokens ?? '');
}

/**
 * 配置 marked
 */
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false,
});

/**
 * 创建自定义渲染器
 */
const renderer = new marked.Renderer();

// 代码块渲染
renderer.code = function (args: any): string {
  const text = tokensToHtml(args?.text ?? args);
  const lang = args?.lang || '';
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';

  let highlighted: string;
  try {
    highlighted = hljs.highlight(text, { language }).value;
  } catch {
    highlighted = hljs.highlightAuto(text).value;
  }

  const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
  return `<pre class="code-block">${langLabel}<code class="hljs language-${language}">${highlighted}</code></pre>`;
};

// 行内代码渲染
renderer.codespan = function (args: any): string {
  const text = tokensToHtml(args?.text ?? args);
  return `<code class="inline-code">${text}</code>`;
};

// 链接渲染
renderer.link = function (args: any): string {
  const href = args?.href || '#';
  const title = args?.title || '';
  const text = tokensToHtml(args?.tokens ?? args?.text ?? args);
  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

// 图片渲染
renderer.image = function (args: any): string {
  const href = args?.href || '';
  const title = args?.title || '';
  const text = args?.text || '';
  const titleAttr = title ? ` title="${title}"` : '';
  return `<img src="${href}" alt="${text}"${titleAttr} class="md-image" loading="lazy" />`;
};

// 表格渲染 - 使用 tokensToHtml 正确处理行内语法
renderer.table = function (args: any): string {
  let headerHtml = '';
  let bodyHtml = '';

  if (typeof args === 'string') {
    // 旧版本：两个参数
    headerHtml = arguments[0] as string;
    bodyHtml = arguments[1] as string;
  } else {
    // 新版本：对象参数 { header: Token[], rows: Token[][] }
    const header = args?.header || [];
    const rows = args?.rows || args?.body || [];

    // 处理表头
    if (Array.isArray(header)) {
      headerHtml = '<tr>' + header.map((cell: any) => {
        // 单元格可能有 tokens 属性，需要递归渲染
        const cellHtml = cell?.tokens ? tokensToHtml(cell.tokens) : tokensToHtml(cell?.text ?? cell);
        return `<th>${cellHtml}</th>`;
      }).join('') + '</tr>';
    } else {
      headerHtml = tokensToHtml(header);
    }

    // 处理表体
    if (Array.isArray(rows)) {
      bodyHtml = rows.map((row: any) => {
        if (Array.isArray(row)) {
          return '<tr>' + row.map((cell: any) => {
            // 单元格可能有 tokens 属性，需要递归渲染
            const cellHtml = cell?.tokens ? tokensToHtml(cell.tokens) : tokensToHtml(cell?.text ?? cell);
            return `<td>${cellHtml}</td>`;
          }).join('') + '</tr>';
        }
        return tokensToHtml(row);
      }).join('');
    } else {
      bodyHtml = tokensToHtml(rows);
    }
  }

  return `<div class="md-table-wrapper"><table class="md-table"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`;
};

// 使用自定义渲染器
marked.use({ renderer });

/**
 * 渲染 Markdown 文本为 HTML
 */
export function renderMarkdown(text: any): string {
  if (!text) return '';

  // 确保 text 是字符串
  const content = typeof text === 'string' ? text : tokensToHtml(text);
  if (!content) return '';

  try {
    const result = marked.parse(content);
    return typeof result === 'string' ? result : content;
  } catch (error) {
    console.error('Markdown 渲染失败:', error);
    return content;
  }
}

export { marked, hljs };
