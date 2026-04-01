"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { type ChatMessage, type ConversationMessage } from "@/lib/types";
import { useCourse } from "@/lib/CourseContext";
import { streamChat } from "@/lib/api";
import { generateId } from "@/lib/utils";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatInput from "@/components/chat/ChatInput";

export default function ChatPage() {
  const { courseId } = useCourse();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const prevCourseRef = useRef(courseId);

  // Reset chat when course changes
  useEffect(() => {
    if (prevCourseRef.current !== courseId) {
      setMessages([]);
      prevCourseRef.current = courseId;
    }
  }, [courseId]);

  // Listen for sidebar problem clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent).detail?.message as string;
      if (message) sendMessage(message);
    };
    window.addEventListener("prefill-chat", handler);
    return () => window.removeEventListener("prefill-chat", handler);
  });

  // Pre-fill from URL query param (e.g., from sidebar problem click on another page)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (streaming) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      const assistantId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);

      // Build history (exclude the assistant placeholder we just added)
      const history: ConversationMessage[] = messages
        .slice(-18)
        .map((m) => ({ role: m.role, content: m.content }));

      const cancel = streamChat(
        text,
        courseId,
        history,
        (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m
            )
          );
        },
        (sources) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
          );
        },
        () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, streaming: false } : m
            )
          );
          setStreaming(false);
        },
        (err) => {
          console.error(err);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Sorry, I ran into an error. Is the backend running on port 8000?",
                    streaming: false,
                  }
                : m
            )
          );
          setStreaming(false);
        }
      );

      cancelRef.current = cancel;
    },
    [courseId, messages, streaming]
  );

  return (
    <>
      <ChatWindow messages={messages} />
      <ChatInput
        onSend={sendMessage}
        disabled={streaming}
        placeholder={`Ask your UCSD TA about ${courseId === "math20c" ? "MATH 20C" : "CSE 12"}...`}
      />
    </>
  );
}
