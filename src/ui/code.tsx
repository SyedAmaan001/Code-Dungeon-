/** Read-only code display with optional stdin and expected output. */
export function CodeBlock({
  code,
  label = "Python",
  caption,
  stdin,
  output,
  exception,
  numbered = false,
}: {
  code: string;
  label?: string;
  caption?: string;
  stdin?: string;
  output?: string;
  exception?: string;
  numbered?: boolean;
}) {
  return (
    <figure className="code">
      <div className="code__label">
        <span>{label}</span>
      </div>
      <pre tabIndex={0} aria-label={`${label} code`}>
        {numbered ? (
          <code className="code-lines">
            {code.split("\n").map((line, i) => (
              <span className="code-line" key={i}>
                {line}
                {"\n"}
              </span>
            ))}
          </code>
        ) : (
          <code>{code}</code>
        )}
      </pre>
      {stdin !== undefined && (
        <div className="code__output">
          <div className="code__label">
            <span>Input typed by the user</span>
          </div>
          <pre>
            <code>{stdin}</code>
          </pre>
        </div>
      )}
      {(output !== undefined || exception !== undefined) && (
        <div className="code__output">
          <div className="code__label">
            <span>{exception ? "Result" : "Output"}</span>
          </div>
          <pre>
            <code>{exception ? `Raises ${exception}` : output}</code>
          </pre>
        </div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
