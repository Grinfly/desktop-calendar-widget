import { useEffect, useRef, useState } from "react";

import type { Task } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskItem } from "./TaskItem";
import { Tooltip } from "./Tooltip";

interface LongTermTaskPanelProps {
  tasks: Task[];
  detailTaskId: string | null;
  onOpenDetail: (taskId: string) => void;
  onCloseDetail: () => void;
  onAdd: (title: string) => void;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onRename: (taskId: string, title: string) => void;
  onColorChange: (taskId: string, colorId: string) => void;
  onNoteChange: (taskId: string, note: string) => void;
  onScheduleToday: (taskId: string) => void;
}

export function LongTermTaskPanel({
  tasks,
  detailTaskId,
  onOpenDetail,
  onCloseDetail,
  onAdd,
  onToggle,
  onDelete,
  onRename,
  onColorChange,
  onNoteChange,
  onScheduleToday,
}: LongTermTaskPanelProps) {
  const [input, setInput] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "active">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingTask = tasks.find((task) => task.id === pendingDeleteId);
  const detailTask = tasks.find((task) => task.id === detailTaskId);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const totalCount = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;
  const activeCount = totalCount - doneCount;

  const displayTasks =
    filterMode === "active" ? tasks.filter((t) => !t.done) : tasks;

  const submit = () => {
    if (!input.trim()) return;
    onAdd(input);
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
          task={detailTask}
          subTitle="长期待办"
          onRename={(title) => onRename(detailTask.id, title)}
          onNoteChange={(note) => onNoteChange(detailTask.id, note)}
        />
      </section>
    );
  }

  return (
    <section className="task-list-view long-term-view" aria-label="长期待办">
      <div className="long-term-header">
        <div className="long-term-stats">
          <span className="long-term-stat-item">
            未完成 <strong>{activeCount}</strong>
          </span>
          <span className="long-term-stat-divider">/</span>
          <span className="long-term-stat-item">
            总计 <strong>{totalCount}</strong>
          </span>
        </div>
        <div className="long-term-filters">
          <button
            type="button"
            className={`long-term-filter-btn ${filterMode === "all" ? "active" : ""}`}
            onClick={() => setFilterMode("all")}
          >
            全部
          </button>
          <button
            type="button"
            className={`long-term-filter-btn ${filterMode === "active" ? "active" : ""}`}
            onClick={() => setFilterMode("active")}
          >
            进行中
          </button>
        </div>
      </div>

      <ul className="task-list long-term-task-list">
        {displayTasks.length === 0 ? (
          <li className="task-empty">
            {filterMode === "active" && totalCount > 0
              ? "太棒了，所有长期待办都已完成！"
              : "还没有长期待办，随时记录长期任务或备忘吧"}
          </li>
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
              onScheduleToday={() => onScheduleToday(task.id)}
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
