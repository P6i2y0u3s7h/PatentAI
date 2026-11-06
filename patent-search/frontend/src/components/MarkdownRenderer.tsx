import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Format inline text: bold, italic, inline-code, links, strikethrough.
 */
function renderInlineText(text: string): React.ReactNode[] {
  // Regex to tokenize inline formatting:
  // 1: code `...`
  // 2: bold **...** or __...__
  // 3: italic *...* or _..._
  // 4: links [label](url)
  // 5: strikethrough ~~...~~
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\)|~~[^~]+~~)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-800/90 border border-slate-700/60 text-teal-300 font-mono text-[11px] sm:text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold **text** or __text__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <strong key={index} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic *text* or _text_
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic text-slate-300">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Strikethrough ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={index} className="line-through text-slate-500">
          {part.slice(2, -2)}
        </del>
      );
    }

    // Links [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors font-medium"
        >
          <span>{label}</span>
          <ExternalLink size={11} className="inline opacity-70" />
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

/**
 * Single CodeBlock with header, language badge, and copy button.
 */
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/90 shadow-lg">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
        <span className="uppercase tracking-wider font-semibold text-teal-400">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed selection:bg-teal-500/30">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Render Markdown Table
 */
const MarkdownTable: React.FC<{ rows: string[][] }> = ({ rows }) => {
  if (rows.length === 0) return null;
  const header = rows[0];
  const bodyRows = rows.slice(1);

  return (
    <div className="my-3.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-md">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-slate-900/95 border-b border-slate-700/80 text-teal-300 font-semibold uppercase tracking-wider text-[11px]">
          <tr>
            {header.map((col, cIdx) => (
              <th key={cIdx} className="px-3.5 py-2.5 font-medium">
                {renderInlineText(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70 text-slate-200">
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors even:bg-slate-950/40">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2 leading-relaxed">
                  {renderInlineText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Main MarkdownRenderer Component
 * Parses raw Markdown text into beautiful SaaS ChatGPT-styled React elements.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split into blocks: fenced code blocks vs standard text
  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');

  let i = 0;
  let elementKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── 1. Fenced Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <CodeBlock key={elementKey++} language={lang} code={codeLines.join('\n')} />
      );
      continue;
    }

    // ── 2. Table: | col1 | col2 |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const curLine = lines[i].trim();
        // Check if delimiter row |---|---|
        if (!/^[|\s:-]+$/.test(curLine)) {
          const cells = curLine
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
          tableRows.push(cells);
        }
        i++;
      }
      if (tableRows.length > 0) {
        elements.push(<MarkdownTable key={elementKey++} rows={tableRows} />);
      }
      continue;
    }

    // ── 3. Headings: #, ##, ###, ####
    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];

        if (level === 1) {
          elements.push(
            <h1 key={elementKey++} className="text-lg sm:text-xl font-bold font-heading text-white mt-4 mb-2 tracking-tight">
              {renderInlineText(text)}
            </h1>
          );
        } else if (level === 2) {
          elements.push(
            <h2 key={elementKey++} className="text-base sm:text-lg font-bold font-heading text-teal-300 mt-3.5 mb-2 pb-1 border-b border-slate-800 tracking-tight">
              {renderInlineText(text)}
            </h2>
          );
        } else if (level === 3) {
          elements.push(
            <h3 key={elementKey++} className="text-sm font-semibold font-heading text-teal-400 mt-3 mb-1.5">
              {renderInlineText(text)}
            </h3>
          );
        } else {
          elements.push(
            <h4 key={elementKey++} className="text-xs font-semibold text-slate-200 mt-2 mb-1">
              {renderInlineText(text)}
            </h4>
          );
        }
        i++;
        continue;
      }
    }

    // ── 4. Horizontal Rule: --- or ***
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      elements.push(<hr key={elementKey++} className="border-slate-800 my-3.5" />);
      i++;
      continue;
    }

    // ── 5. Blockquote: > text
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote
          key={elementKey++}
          className="border-l-4 border-teal-500/80 pl-3.5 py-1.5 my-2.5 bg-teal-500/5 text-slate-300 italic rounded-r-lg text-xs sm:text-sm leading-relaxed"
        >
          {quoteLines.map((qLine, qIdx) => (
            <p key={qIdx} className="my-0.5">
              {renderInlineText(qLine)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // ── 6. Bullet Lists: •, -, *, +
    if (/^\s*([•\-*+]|\d+\.)\s+/.test(line)) {
      const listItems: { isNumbered: boolean; num?: string; text: string }[] = [];
      while (i < lines.length && /^\s*([•\-*+]|\d+\.)\s+/.test(lines[i])) {
        const cur = lines[i];
        const numMatch = cur.match(/^\s*(\d+)\.\s+(.*)$/);
        if (numMatch) {
          listItems.push({ isNumbered: true, num: numMatch[1], text: numMatch[2] });
        } else {
          const bulletMatch = cur.match(/^\s*([•\-*+])\s+(.*)$/);
          listItems.push({ isNumbered: false, text: bulletMatch ? bulletMatch[2] : cur });
        }
        i++;
      }

      elements.push(
        <ul key={elementKey++} className="space-y-1.5 my-2 text-xs sm:text-sm">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-2.5 leading-relaxed text-slate-300">
              {item.isNumbered ? (
                <span className="font-mono text-teal-400 font-bold text-xs shrink-0 mt-0.5 w-4 text-right">
                  {item.num}.
                </span>
              ) : (
                <span className="text-teal-400 text-sm shrink-0 leading-none mt-1">•</span>
              )}
              <div className="flex-1 min-w-0">{renderInlineText(item.text)}</div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── 7. Blank Line: separator
    if (!line.trim()) {
      i++;
      continue;
    }

    // ── 8. Regular Paragraph
    const paragraphLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*([•\-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    elements.push(
      <p key={elementKey++} className="my-2 leading-relaxed text-slate-200 text-xs sm:text-sm">
        {paragraphLines.map((pLine, pIdx) => (
          <React.Fragment key={pIdx}>
            {pIdx > 0 && <br />}
            {renderInlineText(pLine)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className={`markdown-content space-y-1 ${className}`}>{elements}</div>;
};

export default MarkdownRenderer;

