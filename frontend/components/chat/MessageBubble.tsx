"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { type ChatMessage } from "@/lib/types";
import SourceCitation from "./SourceCitation";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-slide-up">
        <div className="max-w-[75%] bg-gradient-to-br from-[#C69214] to-[#E8B84B] text-[#0F1D30] rounded-2xl rounded-tr-sm px-4 py-3 shadow-md shadow-[#C69214]/20">
          <p className="text-sm font-medium whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4 animate-slide-up">
      {/* TA Avatar */}
      <div className="w-8 h-8 rounded-full bg-[#182B49] border border-[#C69214]/50 flex items-center justify-center shrink-0 mt-0.5 mr-2.5 shadow-sm">
        <span className="text-[#C69214] text-[10px] font-bold tracking-tight">TA</span>
      </div>

      <div className="max-w-[80%]">
        <div className="bg-[#182B49] border border-[#C69214]/15 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          {message.streaming && !message.content ? (
            <div className="flex gap-1 items-center py-1">
              <span className="w-2 h-2 rounded-full bg-[#C69214]/50 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-[#C69214]/50 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-[#C69214]/50 animate-bounce [animation-delay:300ms]" />
            </div>
          ) : (
            <div className="message-prose text-sm text-white/85">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    if (match) {
                      return (
                        <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      );
                    }
                    return (
                      <code className={className} {...props}>{children}</code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.streaming && (
                <span className="inline-block w-0.5 h-4 bg-[#C69214] animate-blink ml-0.5 align-text-bottom" />
              )}
            </div>
          )}

          {!message.streaming && message.sources && message.sources.length > 0 && (
            <SourceCitation sources={message.sources} />
          )}
        </div>
        <p className="text-[10px] text-white/25 mt-1 ml-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
