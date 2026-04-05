"use client";

import { useEffect, useMemo, useState } from "react";
import type { DocRecord, MemoryDay, OfficeData, ProjectRecord, Task, TeamData } from "@/lib/mission-control";

type Snapshot = {
  taskBoard: {
    boardName: string;
    heartbeatRule: string;
    columns: Task["status"][];
    tasks: Task[];
  };
  cronJobs: {
    source: string;
    notes: string;
    jobs: {
      id: string;
      name: string;
      schedule: string;
      target: string;
      status: string;
      purpose: string;
      lastRun: string;
    }[];
  };
  projects: ProjectRecord[];
  dailyMemory: MemoryDay[];
  longTermMemory: string;
  docs: DocRecord[];
  team: TeamData;
  office: OfficeData;
  generatedAt: string;
};

type ScreenId = "overview" | "projects" | "docs" | "team" | "office" | "command" | "tasks" | "calendar" | "memory";

type DailyNote = {
  id: string;
  title: string;
  body: string;
  project: string;
  tags: string[];
  createdAt: string;
};

type OperatorPlan = {
  mission: string;
  task: string;
  why: string;
  next: string;
};

type FocusPlan = {
  priorities: string[];
  blocker: string;
  nextMove: string;
};

type ContentPlan = {
  prompt: string;
  hook: string;
  cta: string;
};

type RoutineItem = {
  label: string;
  done: boolean;
};

type CommandState = {
  operator: OperatorPlan;
  operatorHistory: (OperatorPlan & { savedAt: string })[];
  focus: FocusPlan;
  routine: RoutineItem[];
  content: ContentPlan;
  notes: DailyNote[];
};

const navSections: { title: string; items: { id: ScreenId; label: string }[] }[] = [
  {
    title: "Mission",
    items: [
      { id: "overview", label: "Overview" },
      { id: "projects", label: "Projects" },
      { id: "docs", label: "Docs" },
      { id: "team", label: "Team" },
      { id: "office", label: "Office" },
    ],
  },
  {
    title: "Command",
    items: [
      { id: "command", label: "Command Deck" },
      { id: "tasks", label: "Task Board" },
      { id: "calendar", label: "Calendar" },
      { id: "memory", label: "Memory" },
    ],
  },
];

const columnLabels: Record<Task["status"], string> = {
  backlog: "Backlog",
  assigned: "Assigned",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const storageKey = "mission-control-command-v1";

function countAgentTasks(tasks: Task[], assignees: string[]) {
  return tasks.filter((task) => assignees.includes(task.assignee) && task.status !== "done").length;
}

function buildDefaultCommandState(projects: ProjectRecord[]): CommandState {
  const topProjects = projects.slice(0, 3).map((project) => project.name);

  return {
    operator: {
      mission: "Convert strategy into one meaningful finished loop today.",
      task: "Pick the highest-leverage task from the board and push it to a visible shipped state.",
      why: "Execution momentum comes from completed loops, not scattered activity.",
      next: "Once the task ships, log the result and queue the next unblocker.",
    },
    operatorHistory: [],
    focus: {
      priorities: [
        topProjects[0] ? `Move ${topProjects[0]} forward with a concrete deliverable.` : "Choose one flagship build and move it forward.",
        topProjects[1] ? `Keep ${topProjects[1]} visible so strategy does not drift.` : "Keep strategic priorities visible.",
        "Capture what changed so memory stays useful.",
      ],
      blocker: "Attention can fragment across too many parallel ideas and leave nothing fully finished.",
      nextMove: "Use the command deck to convert the next priority into one finished action chain.",
    },
    routine: [
      { label: "Morning review complete", done: false },
      { label: "Deep work block protected", done: false },
      { label: "Primary build moved forward", done: false },
      { label: "Memory note captured", done: false },
      { label: "Content output prepared", done: false },
    ],
    content: {
      prompt: "Share one practical build update: what moved today, why it matters, and what happens next.",
      hook: "We are not building another dashboard. We are building an operating system for execution.",
      cta: "Follow the build and watch the workflow tighten.",
    },
    notes: [],
  };
}

function loadCommandState(projects: ProjectRecord[]): CommandState {
  const fallback = buildDefaultCommandState(projects);

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CommandState>;

    return {
      ...fallback,
      ...parsed,
      operator: { ...fallback.operator, ...parsed.operator },
      focus: {
        ...fallback.focus,
        ...parsed.focus,
        priorities: parsed.focus?.priorities?.length ? parsed.focus.priorities : fallback.focus.priorities,
      },
      content: { ...fallback.content, ...parsed.content },
      routine: parsed.routine?.length ? parsed.routine : fallback.routine,
      notes: parsed.notes ?? [],
      operatorHistory: parsed.operatorHistory ?? [],
    };
  } catch {
    return fallback;
  }
}

function priorityFromStatus(status: string) {
  if (status === "active") return "high";
  if (status === "concept") return "medium";
  return "low";
}

function buildCommandExport(commandState: CommandState, projects: ProjectRecord[], date: string) {
  const touchedProjects = Array.from(new Set(commandState.notes.map((note) => note.project).filter(Boolean)));
  const tags = Array.from(new Set(commandState.notes.flatMap((note) => note.tags).filter(Boolean)));
  const completedRoutine = commandState.routine.filter((item) => item.done).map((item) => item.label);
  const topProjects = projects.slice(0, 3).map((project) => project.name).join(" | ");

  return `# ${date}

## Operator Plan
- Mission: ${commandState.operator.mission}
- Chosen task: ${commandState.operator.task}
- Why this task: ${commandState.operator.why}
- Next move after finish: ${commandState.operator.next}

## Focus
- Priorities: ${commandState.focus.priorities.filter(Boolean).join(" | ")}
- Blocker: ${commandState.focus.blocker}
- Next best move: ${commandState.focus.nextMove}

## Projects In View
- ${topProjects || "(no projects loaded)"}

## Routine
- Completed: ${completedRoutine.length ? completedRoutine.join(", ") : "none recorded"}

## Notes
${commandState.notes.length ? commandState.notes.map((note) => `- ${note.title || "Note"}${note.project ? ` [${note.project}]` : ""}: ${note.body}`).join("\n") : "- No notes yet."}

## Metadata
- Projects touched: ${touchedProjects.length ? touchedProjects.join(", ") : "none"}
- Tags: ${tags.length ? tags.join(", ") : "#daily-log"}`;
}

export function MissionControlDashboard({ snapshot }: { snapshot: Snapshot }) {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("overview");
  const [memoryQuery, setMemoryQuery] = useState("");
  const [docQuery, setDocQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState(snapshot.dailyMemory[0]?.date ?? "");
  const [selectedDoc, setSelectedDoc] = useState(snapshot.docs[0]?.path ?? "");
  const [commandState, setCommandState] = useState<CommandState>(() => loadCommandState(snapshot.projects));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(commandState));
  }, [commandState]);

  const openClawTaskCount = countAgentTasks(snapshot.taskBoard.tasks, ["openclaw-main", "Mwakulomba", "Mwanyama"]);
  const highPriorityTasks = snapshot.taskBoard.tasks.filter((task) => task.priority === "high" && task.status !== "done");
  const activeProjects = snapshot.projects.filter((project) => project.status === "active");
  const commandTasks = snapshot.taskBoard.tasks.filter((task) => ["openclaw-main", "Mwakulomba", "Mwanyama"].includes(task.assignee));

  const filteredMemory = useMemo(() => {
    const q = memoryQuery.trim().toLowerCase();
    if (!q) return snapshot.dailyMemory;
    return snapshot.dailyMemory.filter((day) => `${day.date} ${day.content}`.toLowerCase().includes(q));
  }, [memoryQuery, snapshot.dailyMemory]);

  const filteredDocs = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    if (!q) return snapshot.docs;
    return snapshot.docs.filter((doc) => `${doc.title} ${doc.path} ${doc.category} ${doc.content}`.toLowerCase().includes(q));
  }, [docQuery, snapshot.docs]);

  const commandSearch = useMemo(() => {
    const entries = [
      ...snapshot.dailyMemory.map((day) => ({ title: day.date, detail: day.summaryLines[0] ?? "Daily memory log", context: day.content })),
      ...snapshot.projects.map((project) => ({ title: project.name, detail: project.summary, context: `${project.type} ${project.status} ${project.keywords.join(" ")}` })),
      ...commandState.notes.map((note) => ({ title: note.title || "Untitled note", detail: note.body, context: `${note.project} ${note.tags.join(" ")}` })),
    ];
    const q = memoryQuery.trim().toLowerCase();
    if (!q) return entries.slice(0, 10);
    return entries.filter((entry) => `${entry.title} ${entry.detail} ${entry.context}`.toLowerCase().includes(q)).slice(0, 10);
  }, [commandState.notes, memoryQuery, snapshot.dailyMemory, snapshot.projects]);

  const docCategories = useMemo(() => Array.from(new Set(snapshot.docs.map((doc) => doc.category))).sort(), [snapshot.docs]);
  const activeDay = filteredMemory.find((day) => day.date === selectedDay) ?? filteredMemory[0];
  const activeDoc = filteredDocs.find((doc) => doc.path === selectedDoc) ?? filteredDocs[0];
  const todayMemory = snapshot.dailyMemory[0];
  const yesterdayMemory = snapshot.dailyMemory[1];
  const commandExport = buildCommandExport(commandState, snapshot.projects, todayMemory?.date ?? new Date().toISOString().slice(0, 10));

  function updateOperator(field: keyof OperatorPlan, value: string) {
    setCommandState((current) => ({ ...current, operator: { ...current.operator, [field]: value } }));
  }

  function saveOperatorPlan() {
    const savedAt = new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
    setCommandState((current) => ({
      ...current,
      operatorHistory: [{ ...current.operator, savedAt }, ...current.operatorHistory].slice(0, 8),
    }));
  }

  function updateFocusPriority(index: number, value: string) {
    setCommandState((current) => ({
      ...current,
      focus: {
        ...current.focus,
        priorities: current.focus.priorities.map((item, itemIndex) => (itemIndex === index ? value : item)),
      },
    }));
  }

  function addNote(note: Omit<DailyNote, "id" | "createdAt">) {
    if (!note.body.trim()) return;
    setCommandState((current) => ({
      ...current,
      notes: [
        {
          ...note,
          id: crypto.randomUUID(),
          createdAt: new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }),
        },
        ...current.notes,
      ],
    }));
  }

  return (
    <div className="shell">
      <aside className="sidebar panel">
        <div>
          <div className="eyebrow">Unified Dashboard</div>
          <h1>Mission Control</h1>
          <p className="sidebar-copy">Mission holds the long-horizon map. Command drives today&apos;s execution loop.</p>
        </div>

        <nav className="nav-list" aria-label="Mission Control screens">
          {navSections.map((section) => (
            <div key={section.title} className="nav-group">
              <div className="nav-group-title">{section.title}</div>
              {section.items.map((screen) => (
                <button key={screen.id} className={`nav-button ${activeScreen === screen.id ? "active" : ""}`} onClick={() => setActiveScreen(screen.id)}>
                  <span>{screen.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="panel sidebar-meta">
          <div className="meta-row"><span>Generated</span><strong>{new Date(snapshot.generatedAt).toLocaleString()}</strong></div>
          <div className="meta-row"><span>Active projects</span><strong>{activeProjects.length}</strong></div>
          <div className="meta-row"><span>OpenClaw tasks</span><strong>{openClawTaskCount}</strong></div>
          <div className="meta-row"><span>Command notes</span><strong>{commandState.notes.length}</strong></div>
        </div>
      </aside>

      <main className="content">
        <OverviewScreen hidden={activeScreen !== "overview"} snapshot={snapshot} highPriorityTasks={highPriorityTasks} openClawTaskCount={openClawTaskCount} activeProjects={activeProjects} />
        <ProjectsScreen hidden={activeScreen !== "projects"} projects={snapshot.projects} />
        <DocsScreen hidden={activeScreen !== "docs"} docs={filteredDocs} activeDoc={activeDoc} docQuery={docQuery} setDocQuery={setDocQuery} setSelectedDoc={setSelectedDoc} categories={docCategories} />
        <TeamScreen hidden={activeScreen !== "team"} team={snapshot.team} />
        <OfficeScreen hidden={activeScreen !== "office"} office={snapshot.office} />
        <CommandScreen
          hidden={activeScreen !== "command"}
          commandState={commandState}
          commandTasks={commandTasks}
          projects={snapshot.projects}
          commandSearch={commandSearch}
          todayMemory={todayMemory}
          yesterdayMemory={yesterdayMemory}
          commandExport={commandExport}
          onOperatorChange={updateOperator}
          onSaveOperator={saveOperatorPlan}
          onFocusPriorityChange={updateFocusPriority}
          onFocusFieldChange={(field, value) => setCommandState((current) => ({ ...current, focus: { ...current.focus, [field]: value } }))}
          onRoutineChange={(index, done) => setCommandState((current) => ({ ...current, routine: current.routine.map((item, itemIndex) => (itemIndex === index ? { ...item, done } : item)) }))}
          onContentFieldChange={(field, value) => setCommandState((current) => ({ ...current, content: { ...current.content, [field]: value } }))}
          onReset={() => setCommandState(buildDefaultCommandState(snapshot.projects))}
          onAddNote={addNote}
          onDeleteNote={(id) => setCommandState((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }))}
        />
        <TasksScreen hidden={activeScreen !== "tasks"} board={snapshot.taskBoard} />
        <CalendarScreen hidden={activeScreen !== "calendar"} cronJobs={snapshot.cronJobs} />
        <MemoryScreen hidden={activeScreen !== "memory"} filteredMemory={filteredMemory} activeDay={activeDay} memoryQuery={memoryQuery} setMemoryQuery={setMemoryQuery} setSelectedDay={setSelectedDay} longTermMemory={snapshot.longTermMemory} />
      </main>
    </div>
  );
}

function SectionShell({ hidden, title, subtitle, children }: { hidden: boolean; title: string; subtitle: string; children: React.ReactNode }) {
  if (hidden) return null;
  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <div className="eyebrow">Screen</div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="list-card">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function OverviewScreen({ hidden, snapshot, highPriorityTasks, openClawTaskCount, activeProjects }: {
  hidden: boolean;
  snapshot: Snapshot;
  highPriorityTasks: Task[];
  openClawTaskCount: number;
  activeProjects: ProjectRecord[];
}) {
  return (
    <SectionShell hidden={hidden} title="Mission Overview" subtitle="The merged shell: Mission stays strategic, while Command now handles daily execution inside the same app.">
      <div className="hero panel">
        <div>
          <div className="eyebrow">North star</div>
          <h3>{snapshot.team.missionStatement}</h3>
          <p className="body-copy">Mission Control is now the main operating dashboard. Command Post ideas have been folded in as the execution layer.</p>
        </div>
        <div className="hero-grid">
          <MetricCard label="Command tasks" value={String(openClawTaskCount)} detail="Assigned to the main operator loop" />
          <MetricCard label="Active projects" value={String(activeProjects.length)} detail="Long-horizon bets still in motion" />
          <MetricCard label="Daily logs" value={String(snapshot.dailyMemory.length)} detail="Memory available for context" />
          <MetricCard label="Docs" value={String(snapshot.docs.length)} detail="Searchable workspace documents" />
        </div>
      </div>

      <div className="grid two-up">
        <div className="panel">
          <div className="section-title-row">
            <h3>Mission lane</h3>
            <span className="badge">Strategic</span>
          </div>
          <div className="stack-list">
            {activeProjects.slice(0, 4).map((project) => (
              <div key={project.name} className="list-card">
                <div className="list-card-top">
                  <strong>{project.name}</strong>
                  <span className={`pill priority-${priorityFromStatus(project.status)}`}>{project.status}</span>
                </div>
                <p>{project.summary}</p>
                <div className="muted-row"><span>{project.type}</span><span>{project.dates.join(", ")}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h3>Command lane</h3>
            <span className="badge">Operational</span>
          </div>
          <div className="stack-list">
            {highPriorityTasks.slice(0, 4).map((task) => (
              <div key={task.id} className="list-card">
                <div className="list-card-top">
                  <strong>{task.title}</strong>
                  <span className={`pill priority-${task.priority}`}>{task.priority}</span>
                </div>
                <p>{task.description}</p>
                <div className="muted-row"><span>{task.project}</span><span>{task.assignee}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid two-up">
        <div className="panel">
          <div className="section-title-row">
            <h3>Merge note</h3>
            <span className="badge">MVP</span>
          </div>
          <p className="body-copy">The app shell, workspace data, docs, memory, team, and office views remain from Mission Control. The day-of-execution system now lives in the Command Deck screen.</p>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h3>Heartbeat rule</h3>
            <span className="badge">Automation</span>
          </div>
          <p className="body-copy">{snapshot.taskBoard.heartbeatRule}</p>
          <div className="code-note">
            The execution loop is centered on <code>mission-control/</code>, with task state from <code>data/tasks.json</code> and day planning from the Command Deck.
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function CommandScreen({
  hidden,
  commandState,
  commandTasks,
  projects,
  commandSearch,
  todayMemory,
  yesterdayMemory,
  commandExport,
  onOperatorChange,
  onSaveOperator,
  onFocusPriorityChange,
  onFocusFieldChange,
  onRoutineChange,
  onContentFieldChange,
  onReset,
  onAddNote,
  onDeleteNote,
}: {
  hidden: boolean;
  commandState: CommandState;
  commandTasks: Task[];
  projects: ProjectRecord[];
  commandSearch: { title: string; detail: string; context: string }[];
  todayMemory?: MemoryDay;
  yesterdayMemory?: MemoryDay;
  commandExport: string;
  onOperatorChange: (field: keyof OperatorPlan, value: string) => void;
  onSaveOperator: () => void;
  onFocusPriorityChange: (index: number, value: string) => void;
  onFocusFieldChange: (field: "blocker" | "nextMove", value: string) => void;
  onRoutineChange: (index: number, done: boolean) => void;
  onContentFieldChange: (field: keyof ContentPlan, value: string) => void;
  onReset: () => void;
  onAddNote: (note: Omit<DailyNote, "id" | "createdAt">) => void;
  onDeleteNote: (id: string) => void;
}) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftProject, setDraftProject] = useState("");
  const [draftTags, setDraftTags] = useState("");

  return (
    <SectionShell hidden={hidden} title="Command Deck" subtitle="Today-facing operator surface merged from Command Post into the Mission Control shell.">
      <div className="hero panel compact">
        <div>
          <div className="eyebrow">Execution loop</div>
          <h3>{commandState.operator.task}</h3>
          <p className="body-copy">{commandState.operator.why}</p>
        </div>
        <div className="hero-grid">
          <MetricCard label="Operator tasks" value={String(commandTasks.filter((task) => task.status !== "done").length)} detail="Assigned to the builder loop" />
          <MetricCard label="Routine done" value={String(commandState.routine.filter((item) => item.done).length)} detail="Daily discipline markers completed" />
          <MetricCard label="Notes" value={String(commandState.notes.length)} detail="Quick operator log entries" />
          <MetricCard label="Projects" value={String(projects.length)} detail="Available for next-move tracking" />
        </div>
      </div>

      <div className="command-grid">
        <div className="panel span-2">
          <div className="section-title-row">
            <h3>Morning operator</h3>
            <div className="actions-row">
              <span className="badge">Local state</span>
              <button className="secondary-button" onClick={onReset}>Reset deck</button>
            </div>
          </div>
          <div className="focus-grid">
            <div className="stack-small">
              <label className="field-label"><span>Operator mission</span><textarea className="text-input text-area short" value={commandState.operator.mission} onChange={(event) => onOperatorChange("mission", event.target.value)} /></label>
              <label className="field-label"><span>Chosen task</span><textarea className="text-input text-area short" value={commandState.operator.task} onChange={(event) => onOperatorChange("task", event.target.value)} /></label>
            </div>
            <div className="stack-small">
              <label className="field-label"><span>Why this task</span><textarea className="text-input text-area short" value={commandState.operator.why} onChange={(event) => onOperatorChange("why", event.target.value)} /></label>
              <label className="field-label"><span>Next best move</span><textarea className="text-input text-area short" value={commandState.operator.next} onChange={(event) => onOperatorChange("next", event.target.value)} /></label>
              <button className="primary-button" onClick={onSaveOperator}>Save morning plan</button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h3>Operator history</h3>
            <span className="badge">Recent</span>
          </div>
          <div className="stack-list">
            {commandState.operatorHistory.length ? commandState.operatorHistory.map((entry) => (
              <div key={`${entry.savedAt}-${entry.task}`} className="list-card">
                <div className="list-card-top"><strong>{entry.task}</strong><span className="badge">{entry.savedAt}</span></div>
                <p>{entry.why}</p>
              </div>
            )) : <EmptyCard title="No operator history yet" body="Save the morning plan to create a short execution trail." />}
          </div>
        </div>

        <div className="panel span-2">
          <div className="section-title-row">
            <h3>Today&apos;s focus</h3>
            <span className="badge">Operational priorities</span>
          </div>
          <div className="focus-grid">
            <div className="stack-small">
              {commandState.focus.priorities.map((priority, index) => (
                <label key={`${index}-${priority}`} className="field-label">
                  <span>Priority {index + 1}</span>
                  <input className="text-input" value={priority} onChange={(event) => onFocusPriorityChange(index, event.target.value)} />
                </label>
              ))}
            </div>
            <div className="stack-small">
              <label className="field-label"><span>Current blocker</span><textarea className="text-input text-area short" value={commandState.focus.blocker} onChange={(event) => onFocusFieldChange("blocker", event.target.value)} /></label>
              <label className="field-label"><span>Next best move</span><textarea className="text-input text-area short" value={commandState.focus.nextMove} onChange={(event) => onFocusFieldChange("nextMove", event.target.value)} /></label>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h3>Daily discipline</h3>
            <span className="badge">Checklist</span>
          </div>
          <div className="stack-list">
            {commandState.routine.map((item, index) => (
              <label key={item.label} className="check-item">
                <input type="checkbox" checked={item.done} onChange={(event) => onRoutineChange(index, event.target.checked)} />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="panel span-2">
          <div className="section-title-row">
            <h3>Project next moves</h3>
            <span className="badge">Action strip</span>
          </div>
          <div className="project-grid">
            {projects.map((project) => {
              const latestNote = commandState.notes.find((note) => note.project === project.name);
              const suggestedMove = latestNote?.body || project.summary;

              return (
                <div key={project.name} className="project-card">
                  <div className="list-card-top"><strong>{project.name}</strong><span className={`pill status-${project.status}`}>{project.status}</span></div>
                  <p>{suggestedMove}</p>
                  <div className="muted-row"><span>{project.type}</span><span>{project.dates.join(", ")}</span></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h3>Content prompt</h3>
            <span className="badge">Output</span>
          </div>
          <div className="stack-small">
            <label className="field-label"><span>Prompt</span><textarea className="text-input text-area" value={commandState.content.prompt} onChange={(event) => onContentFieldChange("prompt", event.target.value)} /></label>
            <label className="field-label"><span>Hook</span><textarea className="text-input text-area short" value={commandState.content.hook} onChange={(event) => onContentFieldChange("hook", event.target.value)} /></label>
            <label className="field-label"><span>CTA</span><textarea className="text-input text-area short" value={commandState.content.cta} onChange={(event) => onContentFieldChange("cta", event.target.value)} /></label>
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h3>Memory lookup</h3>
            <span className="badge">Cross-source</span>
          </div>
          <div className="stack-list">
            {commandSearch.length ? commandSearch.map((entry) => (
              <div key={`${entry.title}-${entry.detail}`} className="list-card">
                <strong>{entry.title}</strong>
                <p>{entry.detail}</p>
              </div>
            )) : <EmptyCard title="No lookup results" body="Search in the Memory screen or add quick notes here." />}
          </div>
        </div>

        <div className="panel span-2">
          <div className="section-title-row">
            <h3>Quick daily notes</h3>
            <span className="badge">Append-ready</span>
          </div>
          <div className="note-compose">
            <input className="text-input" placeholder="Short note title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            <select className="select-input" value={draftProject} onChange={(event) => setDraftProject(event.target.value)}>
              <option value="">Choose project</option>
              {projects.map((project) => <option key={project.name} value={project.name}>{project.name}</option>)}
            </select>
            <textarea className="text-input text-area" placeholder="What changed, what matters, what is next?" value={draftBody} onChange={(event) => setDraftBody(event.target.value)} />
            <input className="text-input" placeholder="Tags, comma separated" value={draftTags} onChange={(event) => setDraftTags(event.target.value)} />
            <button
              className="primary-button"
              onClick={() => {
                onAddNote({
                  title: draftTitle.trim(),
                  body: draftBody.trim(),
                  project: draftProject,
                  tags: draftTags.split(",").map((tag) => tag.trim()).filter(Boolean),
                });
                setDraftTitle("");
                setDraftBody("");
                setDraftProject("");
                setDraftTags("");
              }}
            >
              Add note
            </button>
          </div>
          <div className="stack-list">
            {commandState.notes.length ? commandState.notes.map((note) => (
              <div key={note.id} className="list-card">
                <div className="list-card-top"><strong>{note.title || "Untitled note"}</strong><button className="inline-button" onClick={() => onDeleteNote(note.id)}>Delete</button></div>
                <p>{note.body}</p>
                <div className="muted-row"><span>{note.project || "No project"}</span><span>{note.createdAt}</span></div>
                <div className="tag-row">
                  {note.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
                </div>
              </div>
            )) : <EmptyCard title="No notes yet" body="Capture progress here before appending it to the memory system." />}
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <h3>Day review</h3>
            <span className="badge">Compare</span>
          </div>
          <div className="stack-small">
            <div>
              <div className="mini-title">Yesterday</div>
              <pre className="mini-viewer">{yesterdayMemory?.content ?? "No previous daily log available."}</pre>
            </div>
            <div>
              <div className="mini-title">Today</div>
              <pre className="mini-viewer">{todayMemory?.content ?? "No daily log loaded."}</pre>
            </div>
          </div>
        </div>

        <div className="panel span-2">
          <div className="section-title-row">
            <h3>Memory export preview</h3>
            <span className="badge">MVP export</span>
          </div>
          <pre className="doc-viewer">{commandExport}</pre>
        </div>
      </div>
    </SectionShell>
  );
}

function TasksScreen({ hidden, board }: { hidden: boolean; board: Snapshot["taskBoard"] }) {
  return (
    <SectionShell hidden={hidden} title="Task Board" subtitle="Shared execution board for the merged dashboard, still sourced from mission-control task data.">
      <div className="board-grid">
        {board.columns.map((column) => {
          const tasks = board.tasks.filter((task) => task.status === column);
          return (
            <div key={column} className="panel board-column">
              <div className="section-title-row"><h3>{columnLabels[column]}</h3><span className="badge">{tasks.length}</span></div>
              <div className="stack-list">
                {tasks.map((task) => (
                  <div key={task.id} className="task-card">
                    <div className="list-card-top"><strong>{task.title}</strong><span className={`pill priority-${task.priority}`}>{task.priority}</span></div>
                    <p>{task.description}</p>
                    <div className="task-meta"><span>{task.id}</span><span>{task.project}</span></div>
                    <div className="task-meta"><span>{task.assignee}</span><span>{task.dueDate}</span></div>
                    <div className="tag-row">
                      {task.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function CalendarScreen({ hidden, cronJobs }: { hidden: boolean; cronJobs: Snapshot["cronJobs"] }) {
  return (
    <SectionShell hidden={hidden} title="Calendar / Cron" subtitle="Scheduled reviews and operator rhythms that support the day-to-day loop.">
      <div className="panel">
        <div className="section-title-row"><h3>Cron jobs</h3><span className="badge">{cronJobs.source}</span></div>
        <p className="body-copy">{cronJobs.notes}</p>
        <div className="stack-list">
          {cronJobs.jobs.map((job) => (
            <div key={job.id} className="list-card">
              <div className="list-card-top"><strong>{job.name}</strong><span className={`pill status-${job.status.toLowerCase()}`}>{job.status}</span></div>
              <p>{job.purpose}</p>
              <div className="muted-row"><span>{job.schedule}</span><span>{job.target}</span></div>
              <div className="muted-row"><span>Last run</span><span>{job.lastRun}</span></div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function ProjectsScreen({ hidden, projects }: { hidden: boolean; projects: ProjectRecord[] }) {
  return (
    <SectionShell hidden={hidden} title="Projects" subtitle="Long-horizon mission layer sourced from workspace memory so the strategic map stays visible.">
      <div className="project-grid">
        {projects.map((project) => (
          <div key={project.name} className="panel project-card">
            <div className="list-card-top"><strong>{project.name}</strong><span className={`pill status-${project.status}`}>{project.status}</span></div>
            <p>{project.summary}</p>
            <div className="muted-row"><span>{project.type}</span><span>{project.dates.join(", ")}</span></div>
            <div className="tag-row">
              {project.keywords.map((keyword) => <span key={keyword} className="tag-chip">{keyword}</span>)}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function MemoryScreen({ hidden, filteredMemory, activeDay, memoryQuery, setMemoryQuery, setSelectedDay, longTermMemory }: {
  hidden: boolean;
  filteredMemory: MemoryDay[];
  activeDay?: MemoryDay;
  memoryQuery: string;
  setMemoryQuery: (value: string) => void;
  setSelectedDay: (value: string) => void;
  longTermMemory: string;
}) {
  return (
    <SectionShell hidden={hidden} title="Memory" subtitle="Browse daily memory and long-term memory without leaving the merged dashboard.">
      <div className="split-layout">
        <div className="panel memory-list">
          <div className="section-title-row">
            <h3>Daily logs</h3>
            <input className="search-input" value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="Search memory by date or content" />
          </div>
          <div className="stack-list">
            {filteredMemory.map((day) => (
              <button key={day.date} className={`memory-item ${activeDay?.date === day.date ? "selected" : ""}`} onClick={() => setSelectedDay(day.date)}>
                <strong>{day.date}</strong>
                <span>{day.summaryLines[0] ?? "No summary yet"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stack-column">
          <div className="panel viewer-panel">
            <div className="section-title-row"><h3>{activeDay?.date ?? "No memory selected"}</h3><span className="badge">daily</span></div>
            <pre className="doc-viewer">{activeDay?.content ?? "No daily memory file found."}</pre>
          </div>
          <div className="panel viewer-panel">
            <div className="section-title-row"><h3>Long-term memory</h3><span className="badge">MEMORY.md</span></div>
            <pre className="doc-viewer">{longTermMemory}</pre>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function DocsScreen({ hidden, docs, activeDoc, docQuery, setDocQuery, setSelectedDoc, categories }: {
  hidden: boolean;
  docs: DocRecord[];
  activeDoc?: DocRecord;
  docQuery: string;
  setDocQuery: (value: string) => void;
  setSelectedDoc: (value: string) => void;
  categories: string[];
}) {
  return (
    <SectionShell hidden={hidden} title="Docs" subtitle="Searchable workspace documentation for strategy, specs, system notes, and memory context.">
      <div className="split-layout docs-layout">
        <div className="panel docs-list">
          <div className="section-title-row docs-search-row">
            <h3>Library</h3>
            <input className="search-input" value={docQuery} onChange={(event) => setDocQuery(event.target.value)} placeholder="Search title, path, content" />
          </div>
          <div className="category-row">
            {categories.map((category) => <span key={category} className="tag-chip">{category}</span>)}
          </div>
          <div className="stack-list">
            {docs.map((doc) => (
              <button key={doc.path} className={`doc-item ${activeDoc?.path === doc.path ? "selected" : ""}`} onClick={() => setSelectedDoc(doc.path)}>
                <div className="list-card-top"><strong>{doc.title}</strong><span className="badge">{doc.category}</span></div>
                <span className="doc-path">{doc.path}</span>
                <p>{doc.excerpt}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="panel viewer-panel">
          <div className="section-title-row">
            <div>
              <h3>{activeDoc?.title ?? "No document selected"}</h3>
              <p className="doc-path">{activeDoc?.path}</p>
            </div>
            <span className="badge">{activeDoc?.category ?? "Document"}</span>
          </div>
          <pre className="doc-viewer">{activeDoc?.content ?? "No matching document."}</pre>
        </div>
      </div>
    </SectionShell>
  );
}

function TeamScreen({ hidden, team }: { hidden: boolean; team: TeamData }) {
  return (
    <SectionShell hidden={hidden} title="Team" subtitle="Roles and operating principles for the organization layer behind the dashboard.">
      <div className="hero panel compact">
        <div>
          <div className="eyebrow">Mission statement</div>
          <h3>{team.missionStatement}</h3>
        </div>
        <div className="tag-row">
          {team.principles.map((principle) => <span key={principle} className="tag-chip">{principle}</span>)}
        </div>
      </div>

      <div className="project-grid">
        {team.agents.map((agent) => (
          <div key={agent.id} className="panel project-card">
            <div className="list-card-top"><strong>{agent.name}</strong><span className={`pill status-${agent.status}`}>{agent.status}</span></div>
            <p>{agent.role}</p>
            <div className="muted-row"><span>{agent.focus}</span></div>
            <div className="muted-row"><span>{agent.desk}</span></div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function OfficeScreen({ hidden, office }: { hidden: boolean; office: OfficeData }) {
  return (
    <SectionShell hidden={hidden} title="Office" subtitle="Visual room map for who is working, where they sit, and what they are doing.">
      <div className="grid two-up office-layout">
        <div className="panel office-panel">
          <div className="office-grid">
            {office.agents.map((agent) => (
              <div key={agent.id} className={`office-agent status-${agent.status}`} style={{ gridColumn: agent.x, gridRow: agent.y }}>
                <div className="desk" />
                <div className="avatar">{agent.name.slice(0, 1)}</div>
                <div className="agent-label">{agent.name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="stack-column">
          {office.agents.map((agent) => (
            <div key={agent.id} className="panel list-card">
              <div className="list-card-top"><strong>{agent.name}</strong><span className={`pill status-${agent.status}`}>{agent.status}</span></div>
              <p>{agent.activity}</p>
              <div className="muted-row"><span>{agent.desk}</span></div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
