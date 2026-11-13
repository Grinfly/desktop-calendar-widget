import type { AppData, LongTermTask } from "../lib/types";
import type { ExtensionTask, TaskChange, TaskCommand, TaskPatch } from "./types";

export function validateDateKey(value: string | null): void {
  if (value === null) return;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("日期应为 YYYY-MM-DD 或 null（长期待办）");
  }
  const date = new Date(`${value}T12:00:00`);
  const [year, month, day] = value.split("-").map(Number);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    throw new Error("日期无效");
  }
}

export function normalizeTaskPatch(patch: TaskPatch): TaskPatch {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("任务修改无效");
  const result: TaskPatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "done") {
      if (typeof value !== "boolean") throw new Error("完成状态应为布尔值");
      result.done = value;
    } else if (key === "title" || key === "note" || key === "color") {
      if (typeof value !== "string") throw new Error("任务文字应为字符串");
      if (key === "title" && !value.trim()) throw new Error("任务标题不能为空");
      result[key] = key === "title" ? value.trim() : value;
    } else {
      throw new Error(`不支持修改任务字段：${key}`);
    }
  }
  return result;
}

export function listExtensionTasks(data: AppData, dateKey?: string | null): ExtensionTask[] {
  const records: ExtensionTask[] = [];
  if (dateKey !== undefined) validateDateKey(dateKey);
  if (dateKey !== null) {
    for (const [key, tasks] of Object.entries(data.tasks)) {
      if (dateKey !== undefined && key !== dateKey) continue;
      for (const task of tasks) records.push({ dateKey: key, task });
    }
  }
  if (dateKey === null || dateKey === undefined) {
    for (const task of data.longTermTasks ?? []) records.push({ dateKey: null, task });
  }
  return structuredClone(records);
}

/** 命令在入口校验；已被其他操作删除的记录按无操作处理。 */
export function applyTaskCommand(data: AppData, command: TaskCommand): AppData {
  const { dateKey, id } = command;
  const list: LongTermTask[] = dateKey === null ? data.longTermTasks ?? [] : data.tasks[dateKey] ?? [];
  let next: LongTermTask[];
  if (command.type === "create") {
    if (list.some((task) => task.id === id)) return data;
    next = [...list, { id, title: command.title, done: false, note: "" }];
  } else {
    if (!list.some((task) => task.id === id)) return data;
    next = command.type === "remove"
      ? list.filter((task) => task.id !== id)
      : list.map((task) => task.id === id ? { ...task, ...command.patch } : task);
  }
  return dateKey === null
    ? { ...data, longTermTasks: next }
    : { ...data, tasks: { ...data.tasks, [dateKey]: next } };
}

export function diffTasks(before: ExtensionTask[], after: ExtensionTask[]): TaskChange[] {
  const key = (record: ExtensionTask) => JSON.stringify([record.dateKey, record.task.id]);
  const previous = new Map(before.map((record) => [key(record), record]));
  const changes: TaskChange[] = [];
  for (const record of after) {
    const old = previous.get(key(record));
    previous.delete(key(record));
    if (!old) changes.push({ type: "created", after: record });
    else if (JSON.stringify(old.task) !== JSON.stringify(record.task)) {
      changes.push({ type: "updated", before: old, after: record });
    }
  }
  for (const record of previous.values()) changes.push({ type: "removed", before: record });
  return changes;
}
