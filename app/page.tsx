"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Artifact, Component, Ticket } from "@/lib/schemas";
import {
  AREAS,
  GOAL_PLACEHOLDERS,
  TARGET_PLATFORMS,
  TECH_STACK_PRESETS,
  type FrontDoorContext,
  type AreaId,
} from "@/lib/front-door";

const LOCK_PHRASE = "Requirements locked";

type Project = { id: string; name: string; slug: string; company: string };
type ChatListItem = { id: string; title: string | null; createdAt: string; _count: { messages: number } };

export default function PromptArchitectPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [frontDoorOpen, setFrontDoorOpen] = useState(true);
  const [sessionContext, setSessionContext] = useState<FrontDoorContext | null>(
    null
  );
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [component, setComponent] = useState<Component | null>(null);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: "",
    company: "",
    techStack: "",
    brandVoice: "",
    archDecisions: "",
  });
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [lastRequirementsSummary, setLastRequirementsSummary] = useState<string | null>(null);
  const [synthesizedPrompt, setSynthesizedPrompt] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [libraryItems, setLibraryItems] = useState<{ id: string; title: string; area: string; requirementsSummary: string; artifactType: string; artifactSnippet: string | null; createdAt: string; project: { name: string; company: string } | null }[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saveToLibraryTitle, setSaveToLibraryTitle] = useState("");
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  const formState = useState({
    area: "software" as AreaId,
    goal: "",
    techStack: "",
    techStackOther: "",
    targetPlatform: "",
    keyConstraints: "",
    supportingText: "",
    figmaLink: "",
    softwareOutput: "both" as "ticket" | "component" | "both",
  });
  const [form, setForm] = formState;

  const toggleTechPreset = useCallback((preset: string) => {
    setForm((f) => {
      const list = f.techStack.split(",").map((s) => s.trim()).filter(Boolean);
      const has = list.includes(preset);
      const next = has ? list.filter((x) => x !== preset) : [...list, preset];
      return { ...f, techStack: next.join(", ") };
    });
  }, []);

  useEffect(() => {
    setProjectsError(null);
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load projects");
        return r.json();
      })
      .then(setProjects)
      .catch(() => setProjectsError("Database not ready. Run: npx prisma db push && npm run db:seed"));
  }, []);

  useEffect(() => {
    if (selectedProjectId === null || selectedProjectId === undefined) {
      setChats([]);
      return;
    }
    fetch(`/api/chats?projectId=${selectedProjectId}`)
      .then((r) => r.json())
      .then(setChats)
      .catch(() => {});
  }, [selectedProjectId]);

  useEffect(() => {
    if (!showLibrary) return;
    const q = selectedProjectId && selectedProjectId !== "" ? `?projectId=${selectedProjectId}` : "";
    fetch(`/api/library${q}`)
      .then((r) => r.json())
      .then(setLibraryItems)
      .catch(() => {});
  }, [showLibrary, selectedProjectId]);

  const chatBody = useMemo(
    () => ({
      ...(sessionContext ? { context: sessionContext } : {}),
      ...(selectedProjectId != null && selectedProjectId !== "" ? { projectId: selectedProjectId } : { projectId: null }),
      ...(chatId ? { chatId } : {}),
    }),
    [sessionContext, selectedProjectId, chatId]
  );

  const persistMessages = useCallback(
    (userMessage: { role: string; content: string }, assistantMessage: { role: string; content: string }) => {
      if (!chatId) return;
      fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: userMessage.role, content: userMessage.content },
            { role: assistantMessage.role, content: assistantMessage.content },
          ],
        }),
      }).catch(() => {});
    },
    [chatId]
  );

  const {
    messages,
    input,
    setInput,
    handleSubmit: handleChatSubmit,
    isLoading: isChatLoading,
    setMessages,
  } = useChat({
    api: "/api/chat",
    body: chatBody,
  });

  useEffect(() => {
    if (!chatId || messages.length < 2 || isChatLoading) return;
    const last = messages[messages.length - 1];
    const prev = messages[messages.length - 2];
    if (last.role === "assistant" && prev.role === "user" && messages.length > lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length;
      persistMessages(
        { role: prev.role, content: typeof prev.content === "string" ? prev.content : JSON.stringify(prev.content) },
        { role: last.role, content: typeof last.content === "string" ? last.content : JSON.stringify(last.content) }
      );
    }
  }, [messages, isChatLoading, chatId, persistMessages]);

  const lastContent =
    messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
  const canGenerate =
    typeof lastContent === "string" && lastContent.includes(LOCK_PHRASE);
  const isSoftware = sessionContext?.area === "software";

  const startInterview = useCallback(async () => {
    if (!form.goal.trim()) return;
    const techStack = [form.techStack.trim(), form.techStackOther.trim()]
      .filter(Boolean)
      .join(", ") || undefined;
    const company =
      selectedProjectId && selectedProjectId !== ""
        ? (projects.find((p) => p.id === selectedProjectId)?.company ?? "ZERF")
        : "ZERF";
    setSessionContext({
      area: form.area,
      goal: form.goal.trim(),
      company,
      techStack: techStack || undefined,
      targetPlatform: form.targetPlatform.trim() || undefined,
      keyConstraints: form.keyConstraints.trim() || undefined,
      supportingText: form.supportingText.trim() || undefined,
      figmaLink: form.figmaLink.trim() || undefined,
    });
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId && selectedProjectId !== "" ? selectedProjectId : null, title: form.goal.slice(0, 80) }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setChatId(data.id);
        lastMessageCountRef.current = 0;
        setSelectedProjectId((prev) => (prev == null ? "" : prev));
        setChats((prev) => [{ id: data.id, title: data.title ?? form.goal.slice(0, 80), createdAt: data.createdAt, _count: { messages: 0 } }, ...prev]);
      }
    } catch {
      setChatId(null);
    }
    setFrontDoorOpen(false);
  }, [form, selectedProjectId, projects]);

  const createProject = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectForm.name.trim();
    const company = newProjectForm.company.trim();
    if (!name || !company) {
      setCreateProjectError("Name and company are required.");
      return;
    }
    setCreateProjectError(null);
    setIsCreatingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          techStack: newProjectForm.techStack.trim() || null,
          brandVoice: newProjectForm.brandVoice.trim() || null,
          archDecisions: newProjectForm.archDecisions.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateProjectError(data.error || "Failed to create project");
        return;
      }
      setProjects((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedProjectId(data.id);
      setNewProjectForm({ name: "", company: "", techStack: "", brandVoice: "", archDecisions: "" });
      setShowNewProjectForm(false);
    } catch {
      setCreateProjectError("Network error. Try again.");
    } finally {
      setIsCreatingProject(false);
    }
  }, [newProjectForm]);

  const generateAssets = useCallback(async () => {
    setAssetError(null);
    setIsGenerating(true);
    setTicket(null);
    setComponent(null);
    setArtifact(null);
    setLastRequirementsSummary(null);
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const imageUrl = (lastUserMsg as { experimental_attachments?: { url?: string }[] } | undefined)?.experimental_attachments?.find((a) => a.url?.startsWith("data:image"))?.url;
    try {
      const res = await fetch("/api/generate-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          area: sessionContext?.area ?? "software",
          chatId: chatId ?? undefined,
          softwareOutput: sessionContext?.area === "software" ? form.softwareOutput : undefined,
          ...(imageUrl && { imageUrl }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate assets");
      if (data.requirementsSummary) setLastRequirementsSummary(data.requirementsSummary);
      if (data.ticket) setTicket(data.ticket);
      if (data.component) setComponent(data.component);
      if (data.artifact) setArtifact(data.artifact);
      if (data.artifact || data.ticket || data.component) setSaveToLibraryTitle(sessionContext?.goal?.slice(0, 80) ?? "Saved prompt");
    } catch (e) {
      setAssetError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  }, [messages, sessionContext?.area, sessionContext?.goal, chatId, form.softwareOutput]);

  const generatePrompt = useCallback(async () => {
    setAssetError(null);
    setIsGeneratingPrompt(true);
    setSynthesizedPrompt(null);
    setLastRequirementsSummary(null);
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const imageUrl = (lastUserMsg as { experimental_attachments?: { url?: string }[] } | undefined)?.experimental_attachments?.find((a) => a.url?.startsWith("data:image"))?.url;
    try {
      const res = await fetch("/api/generate-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          area: sessionContext?.area ?? "software",
          chatId: chatId ?? undefined,
          outputPromptOnly: true,
          context: sessionContext ?? undefined,
          ...(imageUrl && { imageUrl }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate prompt");
      if (data.requirementsSummary) setLastRequirementsSummary(data.requirementsSummary);
      if (data.prompt) setSynthesizedPrompt(data.prompt);
      setSaveToLibraryTitle(sessionContext?.goal?.slice(0, 80) ?? "Saved prompt");
    } catch (e) {
      setAssetError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [messages, sessionContext, chatId]);

  const saveToLibrary = useCallback(async () => {
    if (!lastRequirementsSummary) return;
    const title = saveToLibraryTitle.trim() || sessionContext?.goal?.slice(0, 80) || "Saved prompt";
    setIsSavingToLibrary(true);
    try {
      const artifactType = synthesizedPrompt && !ticket && !artifact && !component
        ? "prompt"
        : sessionContext?.area === "software"
          ? (form.softwareOutput === "component" ? "component" : form.softwareOutput === "ticket" ? "ticket" : "both")
          : "artifact";
      let snippet: string | null = null;
      if (ticket) snippet = `${(ticket as { title?: string }).title ?? ""}\n${(ticket as { userStory?: string }).userStory ?? ""}`;
      else if (artifact) snippet = `${(artifact as { title?: string }).title ?? ""}\n\n${(artifact as { body?: string }).body ?? ""}`;
      else if (component) snippet = (component as { name?: string; code?: string }).name + "\n\n" + ((component as { code?: string }).code ?? "");
      else if (synthesizedPrompt) snippet = synthesizedPrompt;
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          projectId: selectedProjectId && selectedProjectId !== "" ? selectedProjectId : null,
          area: sessionContext?.area ?? "software",
          requirementsSummary: lastRequirementsSummary,
          artifactType,
          artifactSnippet: snippet || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setLibraryItems((prev) => [data, ...prev]);
      setSaveToLibraryTitle("");
    } catch (e) {
      setAssetError(e instanceof Error ? e.message : "Failed to save to library");
    } finally {
      setIsSavingToLibrary(false);
    }
  }, [lastRequirementsSummary, saveToLibraryTitle, sessionContext?.area, sessionContext?.goal, selectedProjectId, form.softwareOutput, ticket, artifact, component, synthesizedPrompt]);

  const fetchLibrary = useCallback(() => {
    const q = selectedProjectId && selectedProjectId !== "" ? `?projectId=${selectedProjectId}` : "";
    fetch(`/api/library${q}`)
      .then((r) => r.json())
      .then(setLibraryItems)
      .catch(() => {});
  }, [selectedProjectId]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        return;
      }
      setIsAddingImage(true);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setMessages((prev) => [
          ...prev,
          {
            id: `file-${Date.now()}`,
            role: "user" as const,
            content:
              "[Figma/UI screenshot attached for layout, colors, and spacing.]",
            experimental_attachments: [
              { url: dataUrl, contentType: file.type, name: file.name },
            ],
          },
        ]);
        setIsAddingImage(false);
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      };
      reader.onerror = () => {
        setIsAddingImage(false);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [setMessages]
  );

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
        (tc) => `- **${tc.scenario}** → ${tc.expectedResult}`
      ),
    ].join("\n");
    void navigator.clipboard.writeText(text);
  }, [ticket]);

  const copyArtifact = useCallback(() => {
    if (!artifact) return;
    const text = `# ${artifact.title}\n\n${artifact.body}`;
    void navigator.clipboard.writeText(text);
  }, [artifact]);

  const copyComponent = useCallback(() => {
    if (!component) return;
    void navigator.clipboard.writeText(component.code);
  }, [component]);

  const resetSession = useCallback(() => {
    setSessionContext(null);
    setChatId(null);
    setFrontDoorOpen(true);
    setMessages([]);
    setTicket(null);
    setComponent(null);
    setArtifact(null);
    setSynthesizedPrompt(null);
    setLastRequirementsSummary(null);
    setSaveToLibraryTitle("");
    setAssetError(null);
    lastMessageCountRef.current = 0;
  }, [setMessages]);

  const loadChat = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/chats/${id}`);
        const chat = await res.json();
        if (!res.ok || !chat.messages) return;
        setChatId(chat.id);
        setSelectedProjectId(chat.projectId ?? "");
        setMessages(
          chat.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
        lastMessageCountRef.current = chat.messages.length;
        setSessionContext({
          area: "software",
          goal: chat.title ?? "Resumed conversation",
          company: chat.project?.company ?? "ZERF",
        });
        setFrontDoorOpen(false);
      } catch {
        //
      }
    },
    [setMessages]
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--card-border)] bg-[var(--card)] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-xl font-semibold text-[var(--accent)]">
              Prompt Architect
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              ZERF — Reverse prompting & CLEAR. Software, Management, Sales, Design.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLibrary((v) => !v)}
            className="shrink-0 rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          >
            {showLibrary ? "Hide Library" : "Team Library"}
          </button>
        </div>
        {showLibrary && (
          <section className="mt-4 rounded-lg border border-[var(--card-border)] bg-black/10 p-4">
            <h2 className="font-mono text-sm font-medium text-[var(--accent)] mb-3">Team Library — Golden Prompts</h2>
            <p className="text-xs text-[var(--muted)] mb-3">
              Saved prompts that worked. Filter by project when one is selected.
            </p>
            {libraryItems.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No saved prompts yet. Generate assets, then use &quot;Save to Library&quot;.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {libraryItems.map((item) => (
                  <li key={item.id} className="rounded border border-[var(--card-border)] bg-black/20 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-[var(--muted)]">{item.project?.name ?? "ZERF"} · {item.area}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{item.requirementsSummary}</p>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(item.requirementsSummary)}
                      className="mt-2 text-xs text-[var(--accent)] hover:underline"
                    >
                      Copy requirements
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Front Door: dynamic form by Area */}
        {frontDoorOpen && (
          <section className="mb-8 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
            <h2 className="font-mono font-medium text-[var(--accent)]">
              Front Door
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Set your area and goal. Company is taken from the selected project (or ZERF when no project).
            </p>
            {projectsError && (
              <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {projectsError}
              </div>
            )}
            <form
              className="mt-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                startInterview();
              }}
            >
              <div>
                <label
                  htmlFor="project"
                  className="mb-2 block text-xs font-mono text-[var(--muted)]"
                >
                  Project context
                </label>
                <select
                  id="project"
                  value={selectedProjectId ?? ""}
                  onChange={(e) => setSelectedProjectId(e.target.value === "" ? "" : e.target.value || null)}
                  className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-4 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="">No project (ZERF global only)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.company})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  With a project: tech stack, brand voice, and prior decisions are loaded. With “No project”: ZERF brand voice and hospitality-audience only (e.g. LinkedIn, sales outreach).
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewProjectForm((v) => !v)}
                  className="mt-2 text-xs font-mono text-[var(--accent)] hover:underline"
                >
                  {showNewProjectForm ? "Cancel" : "+ New project"}
                </button>
              </div>

              {showNewProjectForm && (
                <div className="rounded-lg border border-[var(--card-border)] bg-black/10 p-4 space-y-4">
                  <p className="text-xs font-mono text-[var(--muted)]">
                    Create a new project context (name and company required).
                  </p>
                  {createProjectError && (
                    <p className="text-sm text-amber-200">{createProjectError}</p>
                  )}
                  <form onSubmit={createProject} className="space-y-3">
                    <div>
                      <label htmlFor="new-project-name" className="mb-1 block text-xs font-mono text-[var(--muted)]">Name</label>
                      <input
                        id="new-project-name"
                        value={newProjectForm.name}
                        onChange={(e) => setNewProjectForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Sandals app Check-in"
                        className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-project-company" className="mb-1 block text-xs font-mono text-[var(--muted)]">Company</label>
                      <input
                        id="new-project-company"
                        value={newProjectForm.company}
                        onChange={(e) => setNewProjectForm((f) => ({ ...f, company: e.target.value }))}
                        placeholder="e.g. Sandals app"
                        className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-project-tech" className="mb-1 block text-xs font-mono text-[var(--muted)]">Tech stack (optional)</label>
                      <input
                        id="new-project-tech"
                        value={newProjectForm.techStack}
                        onChange={(e) => setNewProjectForm((f) => ({ ...f, techStack: e.target.value }))}
                        placeholder="e.g. React, Next.js, TypeScript"
                        className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-project-voice" className="mb-1 block text-xs font-mono text-[var(--muted)]">Brand voice (optional)</label>
                      <textarea
                        id="new-project-voice"
                        value={newProjectForm.brandVoice}
                        onChange={(e) => setNewProjectForm((f) => ({ ...f, brandVoice: e.target.value }))}
                        placeholder="e.g. Warm, clear, guest-facing."
                        rows={2}
                        className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none resize-y"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-project-arch" className="mb-1 block text-xs font-mono text-[var(--muted)]">Architectural decisions (optional)</label>
                      <textarea
                        id="new-project-arch"
                        value={newProjectForm.archDecisions}
                        onChange={(e) => setNewProjectForm((f) => ({ ...f, archDecisions: e.target.value }))}
                        placeholder="e.g. Use App Router; state in URL for wizard steps."
                        rows={2}
                        className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none resize-y"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isCreatingProject}
                        className="rounded-lg bg-[var(--accent-muted)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent)] disabled:opacity-50"
                      >
                        {isCreatingProject ? "Creating…" : "Create project"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewProjectForm(false); setCreateProjectError(null); }}
                        className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {selectedProjectId != null && chats.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs font-mono text-[var(--muted)]">
                    Previous conversations
                  </label>
                  <ul className="space-y-1 rounded-lg border border-[var(--card-border)] bg-black/10 p-2 max-h-32 overflow-y-auto">
                    {chats.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => loadChat(c.id)}
                          className="w-full rounded px-2 py-2 text-left text-sm hover:bg-white/5"
                        >
                          {c.title || "Untitled"} · {c._count.messages} messages
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-mono text-[var(--muted)]">
                  Area / Role
                </label>
                <div className="flex flex-wrap gap-3">
                  {AREAS.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--card-border)] px-4 py-2 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)]/10"
                    >
                      <input
                        type="radio"
                        name="area"
                        value={a.id}
                        checked={form.area === a.id}
                        onChange={() =>
                          setForm((f) => ({ ...f, area: a.id }))
                        }
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{a.label}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {a.role}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {form.area === "software" && (
                <div>
                  <label className="mb-2 block text-xs font-mono text-[var(--muted)]">
                    Generate
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(["ticket", "component", "both"] as const).map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--card-border)] px-3 py-2 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)]/10"
                      >
                        <input
                          type="radio"
                          name="softwareOutput"
                          value={opt}
                          checked={form.softwareOutput === opt}
                          onChange={() =>
                            setForm((f) => ({ ...f, softwareOutput: opt }))
                          }
                          className="sr-only"
                        />
                        <span className="text-sm">
                          {opt === "ticket" ? "Ticket only" : opt === "component" ? "Component only" : "Ticket + Component"}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Component = actual React/TSX code. Ticket = Jira-style spec.
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="goal"
                  className="mb-2 block text-xs font-mono text-[var(--muted)]"
                >
                  Goal
                </label>
                <input
                  id="goal"
                  type="text"
                  value={form.goal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, goal: e.target.value }))
                  }
                  placeholder={GOAL_PLACEHOLDERS[form.area]}
                  className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-4 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                  required
                />
              </div>

              {/* Common questions — minimal typing */}
              <div className="rounded-lg border border-[var(--card-border)] bg-black/10 p-4 space-y-4">
                <p className="text-xs font-mono text-[var(--muted)]">
                  Common details (optional — fewer questions in the interview)
                </p>
                {(form.area === "software" || form.area === "design") && (
                  <>
                    <div>
                      <label className="mb-2 block text-xs font-mono text-[var(--muted)]">
                        Tech stack (click to add)
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {TECH_STACK_PRESETS.map((preset) => {
                          const selected = form.techStack.split(",").map((s) => s.trim()).includes(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => toggleTechPreset(preset)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                selected
                                  ? "bg-[var(--accent)] text-[var(--background)]"
                                  : "border border-[var(--card-border)] text-[var(--muted)] hover:bg-white/5"
                              }`}
                            >
                              {preset}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        value={form.techStackOther}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, techStackOther: e.target.value }))
                        }
                        placeholder="Other (e.g. Redux, Prisma)"
                        className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-3 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="target"
                        className="mb-2 block text-xs font-mono text-[var(--muted)]"
                      >
                        Target
                      </label>
                      <select
                        id="target"
                        value={form.targetPlatform}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, targetPlatform: e.target.value }))
                        }
                        className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-4 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                      >
                        {TARGET_PLATFORMS.map((t) => (
                          <option key={t.id || "none"} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label
                    htmlFor="constraints"
                    className="mb-2 block text-xs font-mono text-[var(--muted)]"
                  >
                    Key constraints
                  </label>
                  <input
                    id="constraints"
                    type="text"
                    value={form.keyConstraints}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, keyConstraints: e.target.value }))
                    }
                    placeholder={
                      form.area === "software" || form.area === "design"
                        ? "e.g. WCAG AA, offline, Safari only"
                        : form.area === "sales"
                          ? "e.g. No pricing in email, NDA"
                          : "e.g. Max 200 words, internal only"
                    }
                    className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-4 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="supporting"
                  className="mb-2 block text-xs font-mono text-[var(--muted)]"
                >
                  Supporting material (optional)
                </label>
                <textarea
                  id="supporting"
                  value={form.supportingText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, supportingText: e.target.value }))
                  }
                  placeholder="Paste notes, brief, or context dump..."
                  rows={3}
                  className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-4 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="figma"
                  className="mb-2 block text-xs font-mono text-[var(--muted)]"
                >
                  Figma link (optional)
                </label>
                <input
                  id="figma"
                  type="url"
                  value={form.figmaLink}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, figmaLink: e.target.value }))
                  }
                  placeholder="https://figma.com/..."
                  className="w-full rounded-lg border border-[var(--card-border)] bg-black/20 px-4 py-2 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!form.goal.trim()}
                className="rounded-lg bg-[var(--accent-muted)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
              >
                Start interview
              </button>
            </form>
          </section>
        )}

        {/* Interview (chat) — shown after Front Door */}
        {!frontDoorOpen && sessionContext && (
          <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-mono font-medium text-[var(--foreground)]">
                  Interview (Reverse Prompting)
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {selectedProjectId === "" ? "ZERF (global)" : (projects.find((p) => p.id === selectedProjectId)?.name ?? "Project")} · {sessionContext.area} · {sessionContext.company} · “
                  {sessionContext.goal}”
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetSession}
                  className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
                >
                  New session
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  disabled={isAddingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--foreground)] disabled:opacity-60"
                >
                  {isAddingImage ? "Adding image…" : "Upload screenshot"}
                </button>
              </div>
            </div>

            <div
              ref={chatScrollRef}
              className="mb-4 max-h-[360px] space-y-4 overflow-y-auto rounded-lg border border-[var(--card-border)] bg-black/20 p-4"
            >
              {messages.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  Send a message to get your first clarifying question. The AI
                  has your goal and project context (company comes from the selected project).
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
                handleChatSubmit(
                  e as unknown as React.FormEvent<HTMLFormElement>
                );
              }}
              className="flex gap-2 items-end"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit(
                      e as unknown as React.FormEvent<HTMLFormElement>
                    );
                  }
                }}
                placeholder="Your answer or next idea... (Shift+Enter for new line)"
                rows={3}
                className="min-h-[80px] max-h-[200px] flex-1 resize-y overflow-y-auto rounded-lg border border-[var(--card-border)] bg-black/20 px-4 py-3 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                disabled={isChatLoading}
              />
              <button
                type="submit"
                disabled={isChatLoading}
                className="shrink-0 rounded-lg bg-[var(--accent-muted)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
              >
                Send
              </button>
            </form>

            {canGenerate && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={generatePrompt}
                  disabled={isGeneratingPrompt}
                  className="rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50"
                >
                  {isGeneratingPrompt ? "Generating…" : "Get the prompt"}
                </button>
                <button
                  type="button"
                  onClick={generateAssets}
                  disabled={isGenerating}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] transition hover:opacity-90 disabled:opacity-50"
                >
                  {isGenerating ? "Generating…" : "Generate assets"}
                </button>
                <span className="text-xs text-[var(--muted)]">
                  Requirements locked — generate{" "}
                  {isSoftware
                    ? form.softwareOutput === "component"
                      ? "component code"
                      : form.softwareOutput === "ticket"
                        ? "ticket, QA plan, client questions"
                        : "ticket + component"
                    : "deliverable"}
                </span>
                {lastRequirementsSummary && (
                  <div className="flex items-center gap-2 ml-2 border-l border-[var(--card-border)] pl-2">
                    <input
                      type="text"
                      value={saveToLibraryTitle}
                      onChange={(e) => setSaveToLibraryTitle(e.target.value)}
                      placeholder="Title for library"
                      className="w-40 rounded border border-[var(--card-border)] bg-black/20 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={saveToLibrary}
                      disabled={isSavingToLibrary}
                      className="rounded-lg border border-[var(--accent)] px-3 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50"
                    >
                      {isSavingToLibrary ? "Saving…" : "Save to Library"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {assetError && (
          <p className="mt-4 text-sm text-red-400">{assetError}</p>
        )}

        {synthesizedPrompt && (
          <section className="mt-8 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-mono font-medium text-[var(--accent)]">
                Generated prompt
              </h2>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(synthesizedPrompt)}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
              >
                Copy prompt
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm text-[var(--foreground)]">{synthesizedPrompt}</p>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Use this prompt in ChatGPT, Claude, or any tool. You can also save it to the Team Library below.
            </p>
          </section>
        )}

        {ticket && (
          <section className="mt-8 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono font-medium text-[var(--accent)]">
                Generated ticket
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
                <h3 className="font-mono text-xs text-[var(--muted)]">Title</h3>
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
                    <li
                      key={i}
                      className="rounded border border-[var(--card-border)] p-2"
                    >
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

        {component && (
          <section className="mt-8 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono font-medium text-[var(--accent)]">
                Generated component
              </h2>
              <button
                type="button"
                onClick={copyComponent}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
              >
                Copy code
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-mono text-xs text-[var(--muted)]">
                {component.name} · {component.filename}
              </p>
              <pre className="max-h-[480px] overflow-auto rounded-lg border border-[var(--card-border)] bg-black/30 p-4 text-xs">
                <code className="whitespace-pre text-[var(--foreground)]">{component.code}</code>
              </pre>
            </div>
          </section>
        )}

        {artifact && (
          <section className="mt-8 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono font-medium text-[var(--accent)]">
                Generated deliverable
              </h2>
              <button
                type="button"
                onClick={copyArtifact}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
              >
                Copy
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-mono text-xs text-[var(--muted)]">Title</h3>
                <p className="mt-1 font-medium">{artifact.title}</p>
              </div>
              <div>
                <h3 className="font-mono text-xs text-[var(--muted)]">Body</h3>
                <div className="mt-1 whitespace-pre-wrap rounded border border-[var(--card-border)] bg-black/20 p-4">
                  {artifact.body}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
