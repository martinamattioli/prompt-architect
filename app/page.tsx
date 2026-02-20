"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useRef, useState } from "react";
import type { Ticket } from "@/lib/schemas";

const LOCK_PHRASE = "Requirements locked";

export default function PromptArchitectPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    input,
    setInput,
    handleSubmit: handleChatSubmit,
    isLoading: isChatLoading,
    setMessages,
  } = useChat({
    api: "/api/chat",
    body: {},
  });

  const lastContent =
    messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
  const canGenerate =
    typeof lastContent === "string" && lastContent.includes(LOCK_PHRASE);

  const generateAssets = useCallback(async () => {
    setAssetError(null);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate assets");
      setTicket(data.ticket);
    } catch (e) {
      setAssetError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setMessages([
        ...messages,
        {
          id: `file-${Date.now()}`,
          role: "user" as const,
          content: "[Figma/UI screenshot attached for layout, colors, and spacing.]",
          experimental_attachments: [
            { url: dataUrl, contentType: file.type, name: file.name },
          ],
        },
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const copyTicket = useCallback(() => {
    if (!ticket) return;
    const text = [
      `# ${ticket.title}`,
      "",
      "## User Story",
      ticket.userStory,
      "",
      "## Technical Requirements",
      ...ticket.technicalRequirements.map((r) => `- ${r}`),
      "",
      "## Acceptance Criteria",
      ...ticket.acceptanceCriteria.map((c) => `- ${c}`),
      "",
      "## Client Questions",
      ...ticket.clientQuestions.map((q) => `- ${q}`),
      "",
      "## QA Test Cases",
      ...ticket.qaTestCases.map(
        (t) => `- **${t.scenario}** → ${t.expectedResult}`
      ),
    ].join("\n");
    void navigator.clipboard.writeText(text);
  }, [ticket]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--card-border)] bg-[var(--card)] px-6 py-4">
        <h1 className="font-mono text-xl font-semibold text-[var(--accent)]">
          Prompt Architect
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ZERF — Reverse prompting → Multi-output assets
        </p>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-mono font-medium text-[var(--foreground)]">
              Interview (Reverse Prompting)
            </h2>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--foreground)]"
              >
                Upload screenshot
              </button>
            </div>
          </div>

          <div className="mb-4 max-h-[360px] space-y-4 overflow-y-auto rounded-lg border border-[var(--card-border)] bg-black/20 p-4">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                Describe your goal (e.g. &quot;Build a stepper&quot;). The AI
                will ask 3–5 clarifying questions before generating assets.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-4 text-right"
                    : "mr-4 text-left"
                }
              >
                <span className="text-xs font-mono text-[var(--muted)]">
                  {m.role}
                </span>
                <div className="mt-1 text-sm">
                  {String(m.content)}
                  {"experimental_attachments" in m &&
                    m.experimental_attachments?.map((att, i) =>
                      att.url.startsWith("data:image") ? (
                        <img
                          key={i}
                          src={att.url}
                          alt={att.name ?? "Uploaded"}
                          className="mt-2 max-h-32 rounded border border-[var(--card-border)] object-contain"
                        />
                      ) : null
                    )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleChatSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Your answer or next idea..."
              className="flex-1 rounded-lg border border-[var(--card-border)] bg-black/20 px-4 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              disabled={isChatLoading}
            />
            <button
              type="submit"
              disabled={isChatLoading}
              className="rounded-lg bg-[var(--accent-muted)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
            >
              Send
            </button>
          </form>

          {canGenerate && (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={generateAssets}
                disabled={isGenerating}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] transition hover:opacity-90 disabled:opacity-50"
              >
                {isGenerating ? "Generating…" : "Generate assets"}
              </button>
              <span className="text-xs text-[var(--muted)]">
                Requirements locked — generate ticket, QA plan, client questions
              </span>
            </div>
          )}
        </section>

        {assetError && (
          <p className="mt-4 text-sm text-red-400">{assetError}</p>
        )}

        {ticket && (
          <section className="mt-8 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono font-medium text-[var(--accent)]">
                Generated assets
              </h2>
              <button
                type="button"
                onClick={copyTicket}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
              >
                Copy as Markdown
              </button>
            </div>
            <div className="space-y-6 text-sm">
              <div>
                <h3 className="font-mono text-xs text-[var(--muted)]">
                  Title
                </h3>
                <p className="mt-1 font-medium">{ticket.title}</p>
              </div>
              <div>
                <h3 className="font-mono text-xs text-[var(--muted)]">
                  User Story
                </h3>
                <p className="mt-1">{ticket.userStory}</p>
              </div>
              <div>
                <h3 className="font-mono text-xs text-[var(--muted)]">
                  Technical Requirements
                </h3>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {ticket.technicalRequirements.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-mono text-xs text-[var(--muted)]">
                  Acceptance Criteria (Gherkin)
                </h3>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {ticket.acceptanceCriteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-mono text-xs text-[var(--muted)]">
                  Client Questions
                </h3>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {ticket.clientQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-mono text-xs text-[var(--muted)]">
                  QA Test Cases
                </h3>
                <ul className="mt-1 space-y-2">
                  {ticket.qaTestCases.map((tc, i) => (
                    <li key={i} className="rounded border border-[var(--card-border)] p-2">
                      <span className="font-medium">{tc.scenario}</span>
                      <span className="text-[var(--muted)]"> → </span>
                      <span>{tc.expectedResult}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
