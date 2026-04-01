"use client";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  return (
    <div className="shrink-0 px-4 pb-4 pt-2 bg-[#0F1D30] border-t border-[#C69214]/15">
      <PromptInputBox
        onSend={(msg) => { if (msg.trim()) onSend(msg.trim()); }}
        isLoading={disabled}
        placeholder={placeholder ?? "Ask your UCSD TA a question..."}
      />
      <p className="text-center text-[10px] text-white/20 mt-2 tracking-wide">
        Your UCSD TA guides you — won&apos;t give away answers directly
      </p>
    </div>
  );
}
