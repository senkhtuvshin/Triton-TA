"use client";
import { useEffect, useRef } from "react";
import { type ChatMessage } from "@/lib/types";
import MessageBubble from "./MessageBubble";

interface ChatWindowProps {
  messages: ChatMessage[];
}

const STARTER_PROMPTS = [
  "How do I find the gradient of a function?",
  "What's the difference between a stack and a queue?",
  "Can you help me understand the Jacobian?",
];

export default function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center bg-[#0F1D30]">
        {/* Glow orb */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#C69214]/30 to-[#182B49] border border-[#C69214]/40 flex items-center justify-center shadow-[0_0_40px_rgba(198,146,20,0.2)]">
            <span className="text-3xl">🎓</span>
          </div>
          <div className="absolute -inset-2 rounded-full border border-[#C69214]/10 animate-ping" />
        </div>

        <h2 className="text-xl font-semibold text-white mb-2 tracking-tight">
          Hi! I&apos;m your UCSD TA
        </h2>
        <p className="text-white/40 text-sm max-w-xs leading-relaxed">
          Ask me about your coursework. I&apos;ll guide you to the answer — Socratic method style.
        </p>

        {/* Starter prompts */}
        <div className="mt-8 grid grid-cols-1 gap-2 w-full max-w-sm">
          {STARTER_PROMPTS.map((prompt) => (
            <div
              key={prompt}
              className="bg-[#182B49] border border-[#C69214]/15 rounded-xl px-4 py-2.5 text-xs text-white/40 text-left italic hover:border-[#C69214]/35 hover:text-white/60 transition-all cursor-default"
            >
              &ldquo;{prompt}&rdquo;
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#0F1D30]">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
