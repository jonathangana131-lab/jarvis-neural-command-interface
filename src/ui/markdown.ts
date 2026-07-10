import { escapeHtml } from '../core/format';

function parseInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderCodeBlock(language: string, content: string, streaming = false) {
  const safeLanguage = escapeHtml(language || 'code');
  return `
    <div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-block-lang">${safeLanguage}${streaming ? ' / streaming' : ''}</span>
        <button class="code-block-copy" type="button"><span>Copy</span></button>
      </div>
      <pre><code class="language-${safeLanguage || 'plaintext'}">${escapeHtml(content)}</code></pre>
    </div>
  `;
}

export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  let html = '';
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeContent: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let inBlockquote = false;

  const closeList = () => {
    if (!listType) return;
    html += `</${listType}>\n`;
    listType = null;
  };

  const closeBlockquote = () => {
    if (!inBlockquote) return;
    html += '</blockquote>\n';
    inBlockquote = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html += renderCodeBlock(codeLanguage, codeContent.join('\n'));
        inCodeBlock = false;
        codeLanguage = '';
        codeContent = [];
      } else {
        closeList();
        closeBlockquote();
        inCodeBlock = true;
        codeLanguage = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    if (line.trim().startsWith('>')) {
      closeList();
      if (!inBlockquote) {
        html += '<blockquote>\n';
        inBlockquote = true;
      }
      html += `<p>${parseInlineMarkdown(line.trim().replace(/^>\s?/, ''))}</p>\n`;
      continue;
    }
    closeBlockquote();

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${parseInlineMarkdown(heading[2].trim())}</h${level}>\n`;
      continue;
    }

    if (/^(---|\*\*\*|___)$/.test(line.trim())) {
      closeList();
      html += '<hr />\n';
      continue;
    }

    const unordered = line.match(/^(?:\*|-|\+)\s+(.*)$/);
    if (unordered) {
      if (listType !== 'ul') {
        closeList();
        html += '<ul>\n';
        listType = 'ul';
      }
      html += `<li>${parseInlineMarkdown(unordered[1].trim())}</li>\n`;
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      if (listType !== 'ol') {
        closeList();
        html += '<ol>\n';
        listType = 'ol';
      }
      html += `<li>${parseInlineMarkdown(ordered[1].trim())}</li>\n`;
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    html += `<p>${parseInlineMarkdown(line)}</p>\n`;
  }

  if (inCodeBlock) {
    html += renderCodeBlock(codeLanguage, codeContent.join('\n'), true);
  }
  closeList();
  closeBlockquote();
  return html;
}
