"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);


  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    setTimeout(() => lastUserMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      const uniqueCitations = [...new Set(data.citations ?? [])] as string[];
      setMessages([
        ...updated,
        { role: "assistant", content: data.reply, citations: uniqueCitations },
      ]);
    } catch {
      setMessages([
        ...updated,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(!open); if (open) setExpanded(false); }}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open
            ? "bg-ink text-paper rotate-0"
            : "bg-accent text-paper hover:scale-105"
        }`}
        aria-label={open ? "Close chat" : "Ask a question"}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed z-50 bg-paper border border-hair shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            expanded
              ? "inset-4"
              : "bottom-24 right-6 w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-8rem)]"
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-hair bg-ink text-paper flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 32 32" className="shrink-0">
              <path
                d="M16 2 L28 7 V16 C28 22 22.5 27.5 16 30 C9.5 27.5 4 22 4 16 V7 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M11 16 L14.5 19.5 L21 13"
                fill="none"
                stroke="#D64545"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-medium">ABST Tutor</div>
              <div className="text-[10px] opacity-70 font-mono">Ask anything about the manual</div>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-paper/10 rounded transition"
              aria-label={expanded ? "Minimize" : "Expand"}
            >
              {expanded ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 3h6v6m-6 12h6v-6M3 9V3h6M3 15v6h6" />
                </svg>
              )}
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && !loading && (
              <div className="text-center py-8 space-y-3">
                <div className="text-slate text-sm">
                  Ask me anything about the ABST manual.
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "What is use of force?",
                    "Explain Section 494",
                    "When can I arrest someone?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => {
                          setInput(q);
                          const form = document.getElementById("chat-form");
                          if (form) form.dispatchEvent(new Event("submit", { bubbles: true }));
                        }, 50);
                      }}
                      className="text-xs px-3 py-1.5 border border-hair rounded-full hover:bg-ink/5 transition text-ink/70"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const isLastUser =
                msg.role === "user" &&
                messages.slice(i + 1).every((m) => m.role !== "user");
              return (
              <div
                key={i}
                ref={isLastUser ? lastUserMsgRef : undefined}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[85%]">
                  <div
                    className={`px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-ink text-paper rounded-2xl rounded-br-sm"
                        : "bg-ink/5 rounded-2xl rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none [&>p]:my-1">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1 px-1">
                      {msg.citations.slice(0, 4).map((c, ci) => (
                        <span
                          key={ci}
                          className="text-[10px] font-mono px-2 py-0.5 bg-gold/15 text-ink/70 rounded-full"
                        >
                          {c.length > 30 ? c.substring(0, 28) + "…" : c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-ink/5 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                  <span className="w-2 h-2 bg-ink/30 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-ink/30 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-ink/30 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            id="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="px-3 py-3 border-t border-hair flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the manual…"
              disabled={loading}
              className="flex-1 text-sm px-3 py-2 border border-hair bg-transparent focus:outline-none focus:border-ink/40 transition placeholder:text-slate/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-3 py-2 bg-ink text-paper text-sm font-mono hover:bg-ink/80 transition disabled:opacity-30"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
