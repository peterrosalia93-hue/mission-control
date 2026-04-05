import fs from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..");
const missionControlDataRoot = path.join(appRoot, "data");

export type Task = {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "assigned" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  assignee: string;
  project: string;
  tags: string[];
  dueDate: string;
};

export type MissionTaskBoard = {
  boardName: string;
  heartbeatRule: string;
  columns: Task["status"][];
  tasks: Task[];
};

export type CronJob = {
  id: string;
  name: string;
  schedule: string;
  target: string;
  status: string;
  purpose: string;
  lastRun: string;
};

export type TeamAgent = {
  id: string;
  name: string;
  role: string;
  status: string;
  focus: string;
  desk: string;
};

export type TeamData = {
  missionStatement: string;
  principles: string[];
  agents: TeamAgent[];
};

export type OfficeAgent = {
  id: string;
  name: string;
  x: number;
  y: number;
  status: string;
  activity: string;
  desk: string;
};

export type OfficeData = {
  rooms: { id: string; name: string; theme: string }[];
  agents: OfficeAgent[];
};

export type ProjectRecord = {
  name: string;
  type: string;
  status: string;
  summary: string;
  dates: string[];
  keywords: string[];
};

export type MemoryDay = {
  fileName: string;
  date: string;
  content: string;
  summaryLines: string[];
};

export type DocRecord = {
  title: string;
  path: string;
  category: string;
  content: string;
  excerpt: string;
};

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function readText(filePath: string, fallback = ""): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

async function walkMarkdownFiles(dir: string, prefix = ""): Promise<DocRecord[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const docs: DocRecord[] = [];

  for (const entry of entries) {
    if (["node_modules", ".git", ".next"].includes(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    const relative = path.join(prefix, entry.name).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      docs.push(...(await walkMarkdownFiles(absolute, relative)));
      continue;
    }

    if (!entry.name.toLowerCase().endsWith(".md")) continue;

    const content = await readText(absolute);
    docs.push({
      title: entry.name.replace(/\.md$/i, ""),
      path: relative,
      category: categorizeDoc(relative),
      content,
      excerpt: content.split(/\r?\n/).filter(Boolean).slice(0, 4).join(" ").slice(0, 240),
    });
  }

  return docs;
}

function categorizeDoc(relativePath: string): string {
  const clean = relativePath.toLowerCase();
  if (clean.startsWith("memory/")) return "Memory";
  if (clean.includes("plan") || clean.includes("spec") || clean.includes("template")) return "Planning";
  if (clean.includes("readme")) return "Reference";
  if (clean.includes("soul") || clean.includes("identity") || clean.includes("user") || clean.includes("agents")) return "Core";
  if (clean.includes("council") || clean.includes("command-post")) return "Systems";
  return "Workspace";
}

export async function getTaskBoard(): Promise<MissionTaskBoard> {
  return readJsonFile<MissionTaskBoard>(path.join(missionControlDataRoot, "tasks.json"));
}

export async function getCronJobs(): Promise<{ source: string; notes: string; jobs: CronJob[] }> {
  return readJsonFile(path.join(missionControlDataRoot, "cron-jobs.json"));
}

export async function getTeamData(): Promise<TeamData> {
  return readJsonFile<TeamData>(path.join(missionControlDataRoot, "team.json"));
}

export async function getOfficeData(): Promise<OfficeData> {
  return readJsonFile<OfficeData>(path.join(missionControlDataRoot, "office.json"));
}

export async function getProjects(): Promise<ProjectRecord[]> {
  const projectsPath = path.join(workspaceRoot, "memory", "projects.json");
  const raw = await readJsonFile<{ projects: ProjectRecord[] }>(projectsPath);
  return raw.projects;
}

export async function getDailyMemory(): Promise<MemoryDay[]> {
  const memoryRoot = path.join(workspaceRoot, "memory");
  const entries = await fs.readdir(memoryRoot, { withFileTypes: true });
  const dailyFiles = entries
    .filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  const days = await Promise.all(
    dailyFiles.map(async (fileName) => {
      const content = await readText(path.join(memoryRoot, fileName));
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "));

      return {
        fileName,
        date: fileName.replace(/\.md$/, ""),
        content,
        summaryLines: lines.slice(0, 8),
      } satisfies MemoryDay;
    })
  );

  return days;
}

export async function getLongTermMemory(): Promise<string> {
  return readText(path.join(workspaceRoot, "MEMORY.md"));
}

export async function getDocs(): Promise<DocRecord[]> {
  const docs = await walkMarkdownFiles(workspaceRoot);
  return docs.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getWorkspaceSnapshot() {
  const [taskBoard, cronJobs, projects, dailyMemory, longTermMemory, docs, team, office] = await Promise.all([
    getTaskBoard(),
    getCronJobs(),
    getProjects(),
    getDailyMemory(),
    getLongTermMemory(),
    getDocs(),
    getTeamData(),
    getOfficeData(),
  ]);

  return {
    taskBoard,
    cronJobs,
    projects,
    dailyMemory,
    longTermMemory,
    docs,
    team,
    office,
    generatedAt: new Date().toISOString(),
  };
}
