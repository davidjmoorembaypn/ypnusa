import { Fragment } from "react";
import { parseRichText, type RichInline } from "./rich-text-parse";

function Inline({ parts, linkClassName }: { parts: RichInline[]; linkClassName: string }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "bold") return <strong key={index}>{part.text}</strong>;
        if (part.type === "link") {
          const external = !part.href.startsWith("/");
          return (
            <a
              key={index}
              href={part.href}
              className={linkClassName}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {part.text}
            </a>
          );
        }
        return <Fragment key={index}>{part.text}</Fragment>;
      })}
    </>
  );
}

/** Renders assistant text with basic Markdown (lists, bold, links) as React elements — no raw HTML. */
export function RichText({ text, linkClassName = "underline underline-offset-2" }: { text: string; linkClassName?: string }) {
  const blocks = parseRichText(text);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={index} className={`space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline parts={item} linkClassName={linkClassName} />
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                <Inline parts={line} linkClassName={linkClassName} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
