import React from 'react';

interface SafeMarkdownProps {
  content: string;
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ content }) => {
  // Split into lines to parse line-level Markdown structures
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let listItems: string[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    const ListTag = isNumberedList ? 'ol' : 'ul';
    elements.push(
      <ListTag
        key={`list-${elements.length}`}
        className={`my-2 space-y-1 pl-5 text-xs text-stone-800 ${
          isNumberedList ? 'list-decimal' : 'list-disc'
        }`}
      >
        {listItems.map((item, idx) => (
          <li key={idx} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>
    );
    listItems = [];
    isNumberedList = false;
  };

  const flushCodeBlock = () => {
    if (!inCodeBlock) return;
    elements.push(
      <pre
        key={`code-${elements.length}`}
        className="my-2.5 p-3 rounded-xl bg-stone-900 text-stone-100 text-[11px] font-mono overflow-x-auto shadow-2xs"
      >
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
    codeBlockLines = [];
    inCodeBlock = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Check headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4
          key={`h4-${elements.length}`}
          className="text-xs font-bold text-stone-900 uppercase tracking-wider mt-3 mb-1"
        >
          {renderInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3
          key={`h3-${elements.length}`}
          className="text-sm font-bold text-stone-900 tracking-tight mt-3.5 mb-1.5"
        >
          {renderInlineMarkdown(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2
          key={`h2-${elements.length}`}
          className="text-base font-extrabold text-stone-900 tracking-tight mt-4 mb-2"
        >
          {renderInlineMarkdown(trimmed.replace(/^#\s+/, ''))}
        </h2>
      );
      continue;
    }

    // Check blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="my-2 pl-3.5 border-l-2 border-stone-800 italic text-xs text-stone-700 bg-stone-100/70 py-1 rounded-r-lg"
        >
          {renderInlineMarkdown(trimmed.replace(/^>\s+/, ''))}
        </blockquote>
      );
      continue;
    }

    // Check unordered list item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (isNumberedList) flushList();
      isNumberedList = false;
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    // Check numbered list item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (!isNumberedList && listItems.length > 0) flushList();
      isNumberedList = true;
      listItems.push(numMatch[2]);
      continue;
    }

    // Empty line separates blocks
    if (!trimmed) {
      flushList();
      continue;
    }

    // Normal paragraph line
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="my-1.5 text-xs text-stone-800 leading-relaxed">
        {renderInlineMarkdown(rawLine)}
      </p>
    );
  }

  flushList();
  flushCodeBlock();

  return <div className="space-y-1">{elements}</div>;
};

/**
 * Safely parses inline markdown (bold, italic, code) into React elements.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Tokenize bold, code, and italic
  // Regex matches: `code`, **bold**, *italic*
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const segments = text.split(tokenRegex);

  segments.forEach((seg, idx) => {
    if (!seg) return;

    if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
      parts.push(
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-stone-200/80 font-mono text-[11px] text-stone-900 border border-stone-300/60"
        >
          {seg.slice(1, -1)}
        </code>
      );
    } else if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
      parts.push(
        <strong key={idx} className="font-bold text-stone-950">
          {seg.slice(2, -2)}
        </strong>
      );
    } else if (seg.startsWith('*') && seg.endsWith('*') && seg.length >= 2) {
      parts.push(
        <em key={idx} className="italic text-stone-900">
          {seg.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(<span key={idx}>{seg}</span>);
    }
  });

  return parts;
}
