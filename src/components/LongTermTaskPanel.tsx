import { useEffect, useRef, useState } from "react";

import type { LongTermTask, TaskDetailUpdate } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskItem } from "./TaskItem";
import { Tooltip } from "./Tooltip";

interface LongTermTaskPanelProps {
  tasks: LongTermTask[];
  detailTaskId: string | null;
  onOpenDetail: (taskId: string) => void;
  onCloseDetail: () => void;
  onAdd: (title: string) => void;
  onToggle: (taskId: string) => void;
  onToggleArchive: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onRename: (taskId: string, title: string) => void;
  onColorChange: (taskId: string, colorId: string) => void;
  onDetailsChange: (taskId: string, update: TaskDetailUpdate) => void;
  onScheduleToday: (taskId: string) => void;
}

export function LongTermTaskPanel({
  tasks,
  detailTaskId,
  onOpenDetail,
  onCloseDetail,
  onAdd,
  onToggle,
  onToggleArchive,
  onDelete,
  onRename,
  onColorChange,
  onDetailsChange,
  onScheduleToday,
}: LongTermTaskPanelProps) {
  const [input, setInput] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "active" | "archived">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingTask = tasks.find((task) => task.id === pendingDeleteId);
  const detailTask = tasks.find((task) => task.id === detailTaskId);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const currentTasks = tasks.filter((task) => !task.archived);
  const activeTasks = currentTasks.filter((task) => !task.done);
  const archivedTasks = tasks.filter((task) => task.archived);
  const displayTasks = { all: currentTasks, active: activeTasks, archived: archivedTasks }[filterMode];
  const emptyMessage = {
    all: "还没有长期待办，随时记录长期任务或备忘吧",
    active: currentTasks.length > 0
      ? "太棒了，所有长期待办都已完成！"
      : "还没有进行中的长期待办",
    archived: "还没有已归档的长期待办",
  }[filterMode];

  const submit = () => {
    if (!input.trim()) return;
    onAdd(input);
    if (filterMode === "archived") setFilterMode("all");
    setInput("");
    inputRef.current?.focus();
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    onDelete(pendingDeleteId);
    setPendingDeleteId(null);
    if (detailTaskId === pendingDeleteId) {
      onCloseDetail();
    }
  };

  if (detailTask) {
    return (
      <section className="task-list-view long-term-view">
        <TaskDetailPanel
          key={detailTask.id}
          task={detailTask}
          subTitle="长期待办"
          onRename={(title) => onRename(detailTask.id, title)}
          onDetailsChange={(update) => onDetailsChange(detailTask.id, update)}
        />
      </section>
    );
  }

  return (
    <section className="task-list-view long-term-view" aria-label="长期待办">
      <div className="long-term-header">
        <div className="long-term-stats">
          {filterMode === "archived" ? (
            <span className="long-term-stat-item">
              已归档 <strong>{archivedTasks.length}</strong>
            </span>
          ) : (
            <>
              <span className="long-term-stat-item">
                未完成 <strong>{activeTasks.length}</strong>
              </span>
              <span className="long-term-stat-divider">/</span>
              <span className="long-term-stat-item">
                总计 <strong>{currentTasks.length}</strong>
              </span>
            </>
          )}
        </div>
        <div className="long-term-filters">
          <button
            type="button"
            className={`long-term-filter-btn ${filterMode === "all" ? "active" : ""}`}
            onClick={() => setFilterMode("all")}
            aria-pressed={filterMode === "all"}
          >
            全部
          </button>
          <button
            type="button"
            className={`long-term-filter-btn ${filterMode === "active" ? "active" : ""}`}
            onClick={() => setFilterMode("active")}
            aria-pressed={filterMode === "active"}
          >
            进行中
          </button>
          <button
            type="button"
            className={`long-term-filter-btn ${filterMode === "archived" ? "active" : ""}`}
            onClick={() => setFilterMode("archived")}
            aria-pressed={filterMode === "archived"}
          >
            已归档
          </button>
        </div>
      </div>

      <ul className="task-list long-term-task-list">
        {displayTasks.length === 0 ? (
          <li className="task-empty">{emptyMessage}</li>
        ) : (
          displayTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={() => onToggle(task.id)}
              onRequestDelete={() => setPendingDeleteId(task.id)}
              onRequestDetail={() => onOpenDetail(task.id)}
              onRename={(title) => onRename(task.id, title)}
              onColorChange={(colorId) => onColorChange(task.id, colorId)}
              onScheduleToday={task.archived ? undefined : () => onScheduleToday(task.id)}
              archiveAction={{
                label: task.archived ? "恢复待办" : "归档",
                onClick: () => onToggleArchive(task.id),
              }}
            />
          ))
        )}
      </ul>

      <div className="task-footer">
        <div className="task-add-row">
          <input
            ref={inputRef}
            className="task-add-input"
            value={input}
            placeholder="记录长期待办..."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          <Tooltip content="添加长期待办" placement="top">
            <button type="button" className="task-add-button" onClick={submit}>
              <span className="task-add-icon" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>

      {pendingTask && (
        <ConfirmDialog
          target={pendingTask.title}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </section>
  );
}
