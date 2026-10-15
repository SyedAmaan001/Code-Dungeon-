/**
 * Renders lesson text ("Markdown-light": paragraphs separated by blank lines, `code` spans
 * and ``` fenced code blocks) as React elements. No HTML from content is ever injected.
 */
import { Fragment } from "react";
import { CodeBlock } from "./code";

export type RichBlock = { kind: "paragraph"; text: string } | { kind: "code"; code: string };

/** Split lesson text into paragraphs and fenced code blocks (indentation preserved). */
export function parseRichText(text: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  // Alternates prose, fence body, prose, fence body, … (capture group = fence body).
  const parts = text.split(/^```[^\n]*\n([\s\S]*?)\n[ \t]*```[ \t]*$/m);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      blocks.push({ kind: "code", code: part.replace(/\s+$/, "") });
      return;
    }
    for (const p of part.split(/\n\s*\n/)) {
      const trimmed = p.trim();
      if (trimmed) blocks.push({ kind: "paragraph", text: trimmed });
    }
  });
  return blocks;
}

export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith("`") && part.endsWith("`") ? (
          <code key={i}>{part.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((block, i) =>
        block.kind === "code" ? (
          <CodeBlock key={i} code={block.code} />
        ) : (
          <p key={i}>
            <InlineText text={block.text} />
          </p>
        ),
      )}
    </>
  );
}
