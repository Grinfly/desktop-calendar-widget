import { invoke } from "@tauri-apps/api/core";

import { parseDateKey, toDateKey } from "./dates";
import type { AppData, LongTermTask, Task } from "./types";

export interface TaskBackup {
  version: 1;
  tasks: AppData["tasks"];
  longTermTasks: LongTermTask[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTask(value: unknown): LongTermTask {
  if (!isRecord(value) ||
    typeof value.id !== "string" || !value.id.trim() ||
    typeof value.title !== "string" || !value.title.trim() ||
    typeof value.done !== "boolean" || typeof value.note !== "string" ||
    (value.color !== undefined && typeof value.color !== "string") ||
    (value.archived !== undefined && typeof value.archived !== "boolean")
  ) {
    throw new Error("备份中含有无效的待办记录");
  }
  return { id: value.id, title: value.title, done: value.done, note: value.note, color: value.color, archived: value.archived };
}

export function parseTaskBackup(json: string): TaskBackup {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  if (!isRecord(value) || value.version !== 1 ||
    !isRecord(value.tasks) || !Array.isArray(value.longTermTasks)
  ) {
    throw new Error("请选择蚕豆导出的待办备份文件");
  }

  const tasks: AppData["tasks"] = {};
  for (const [key, entries] of Object.entries(value.tasks)) {
    const date = parseDateKey(key);
    if (!Array.isArray(entries) || !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
      Number.isNaN(date.getTime()) || toDateKey(date) !== key
    ) {
      throw new Error("备份中含有无效的日期待办列表");
    }
    tasks[key] = entries.map((entry) => {
      const { id, title, done, note, color } = readTask(entry);
      return { id, title, done, note, color };
    });
  }
  return { version: 1, tasks, longTermTasks: value.longTermTasks.map(readTask) };
}

export function mergeTaskBackup(data: AppData, backup: TaskBackup): AppData {
  const tasks = { ...data.tasks };
  const longTermTasks = [...(data.longTermTasks ?? [])];
  const ids = new Set([...Object.values(tasks).flat(), ...longTermTasks].map((task) => task.id));
  function appendNew<T extends Task>(target: T[], entries: T[]) {
    for (const task of entries) {
      if (ids.has(task.id)) continue;
      ids.add(task.id);
      target.push(task);
    }
  }
  for (const [date, entries] of Object.entries(backup.tasks)) {
    const target = [...(tasks[date] ?? [])];
    appendNew(target, entries);
    if (target.length) tasks[date] = target;
  }
  appendNew(longTermTasks, backup.longTermTasks);
  return { ...data, tasks, longTermTasks };
}

export function exportTaskBackup(data: Pick<AppData, "tasks" | "longTermTasks">): Promise<boolean> {
  const backup: TaskBackup = { version: 1, tasks: data.tasks, longTermTasks: data.longTermTasks ?? [] };
  return invoke("export_task_backup", {
    json: JSON.stringify(backup, null, 2),
    fileName: `蚕豆待办备份-${toDateKey(new Date())}.json`,
  });
}

export async function importTaskBackup(): Promise<TaskBackup | null> {
  const json = await invoke<string | null>("read_task_backup");
  return json === null ? null : parseTaskBackup(json);
}
