/**
 * Renders lesson text ("Markdown-light": paragraphs separated by blank lines and `code`
 * spans) as React elements. No HTML from content is ever injected.
 */
import { Fragment } from "react";

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
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>
            <InlineText text={p} />
          </p>
        ))}
    </>
  );
}
