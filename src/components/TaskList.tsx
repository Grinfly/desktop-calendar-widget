import { useEffect, useRef, useState } from "react";

import type { Task } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { TaskItem } from "./TaskItem";
import { Tooltip } from "./Tooltip";

interface TaskListProps {
  dateKey: string;
  tasks: Task[];
  onAdd: (title: string) => void;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onRename: (taskId: string, title: string) => void;
  onColorChange: (taskId: string, colorId: string) => void;
}

export function TaskList({
  dateKey,
  tasks,
  onAdd,
  onToggle,
  onDelete,
  onRename,
  onColorChange,
}: TaskListProps) {
  const [input, setInput] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingTask = tasks.find((task) => task.id === pendingDeleteId);

  useEffect(() => {
    inputRef.current?.focus();
  }, [dateKey]);

  useEffect(() => {
    setPendingDeleteId(null);
  }, [dateKey]);

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
  };

  return (
    <section className="task-list-view">
      <ul className="task-list">
        {tasks.length === 0 ? (
          <li className="task-empty">今天还没有待办，添加一条吧</li>
        ) : (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={() => onToggle(task.id)}
              onRequestDelete={() => setPendingDeleteId(task.id)}
              onRename={(title) => onRename(task.id, title)}
              onColorChange={(colorId) => onColorChange(task.id, colorId)}
            />
          ))
        )}
      </ul>

      <div className="task-add-row">
        <input
          ref={inputRef}
          className="task-add-input"
          value={input}
          placeholder="添加待办..."
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
        <Tooltip content="添加待办" placement="top">
          <button type="button" className="task-add-button" onClick={submit}>
            <span className="task-add-icon" aria-hidden="true" />
          </button>
        </Tooltip>
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
