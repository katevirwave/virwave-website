/* ============================================================
   VirWave — Minimal Markdown Parser
   No dependencies. Handles: headings, paragraphs, bold, italic,
   links, images, lists, blockquotes, code blocks, inline code,
   horizontal rules.
   ============================================================ */

var VWMarkdown = (function () {
  'use strict';

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseInline(text) {
    // Images: ![alt](src)
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Bold+Italic: ***text*** or ___text___
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    // Bold: **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    return text;
  }

  function parse(markdown) {
    var lines = markdown.split('\n');
    var html = [];
    var i = 0;
    var len = lines.length;

    while (i < len) {
      var line = lines[i];

      // Empty line
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Code block: ```
      if (line.trim().startsWith('```')) {
        var lang = line.trim().slice(3).trim();
        var code = [];
        i++;
        while (i < len && !lines[i].trim().startsWith('```')) {
          code.push(escapeHtml(lines[i]));
          i++;
        }
        i++; // skip closing ```
        html.push('<pre>' + (lang ? '<code class="language-' + lang + '">' : '<code>') + code.join('\n') + '</code></pre>');
        continue;
      }

      // Headings: # H1 through ###### H6
      var headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        var level = headingMatch[1].length;
        html.push('<h' + level + '>' + parseInline(headingMatch[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      // Horizontal rule: --- or ***  or ___
      if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
        html.push('<hr>');
        i++;
        continue;
      }

      // Blockquote: >
      if (line.trim().startsWith('>')) {
        var quoteLines = [];
        while (i < len && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        html.push('<blockquote>' + parseInline(quoteLines.join(' ')) + '</blockquote>');
        continue;
      }

      // Unordered list: - or *
      if (/^\s*[-*]\s+/.test(line)) {
        var items = [];
        while (i < len && /^\s*[-*]\s+/.test(lines[i])) {
          items.push('<li>' + parseInline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>');
          i++;
        }
        html.push('<ul>' + items.join('') + '</ul>');
        continue;
      }

      // Ordered list: 1.
      if (/^\s*\d+\.\s+/.test(line)) {
        var olItems = [];
        while (i < len && /^\s*\d+\.\s+/.test(lines[i])) {
          olItems.push('<li>' + parseInline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>');
          i++;
        }
        html.push('<ol>' + olItems.join('') + '</ol>');
        continue;
      }

      // Paragraph: collect consecutive non-empty, non-special lines
      var paraLines = [];
      while (
        i < len &&
        lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('#') &&
        !lines[i].trim().startsWith('>') &&
        !lines[i].trim().startsWith('```') &&
        !/^\s*[-*]\s+/.test(lines[i]) &&
        !/^\s*\d+\.\s+/.test(lines[i]) &&
        !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length) {
        html.push('<p>' + parseInline(paraLines.join(' ')) + '</p>');
      }
    }

    return html.join('\n');
  }

  return { parse: parse };
})();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.VWMarkdown = VWMarkdown;
}
