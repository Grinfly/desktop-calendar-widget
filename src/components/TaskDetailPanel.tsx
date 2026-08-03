import { useEffect, useState } from "react";

import { formatDayTitle } from "../lib/dates";
import type { Task } from "../lib/types";

interface TaskDetailPanelProps {
  task: Task;
  dateKey: string;
  onRename: (title: string) => void;
  onNoteChange: (note: string) => void;
}

export function TaskDetailPanel({
  task,
  dateKey,
  onRename,
  onNoteChange,
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");

  useEffect(() => {
    setTitle(task.title);
    setNote(task.note ?? "");
  }, [task.id, task.title, task.note]);

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      onRename(trimmed);
    } else {
      setTitle(task.title);
    }
  };

  const commitNote = () => {
    if (note !== (task.note ?? "")) {
      onNoteChange(note);
    }
  };

  return (
    <section className="task-detail-panel" aria-label="待办详情">
      <div className="task-detail-label-row">
        <label className="task-detail-label" htmlFor="task-detail-title-input">
          标题
        </label>
        <span className="task-detail-date">{formatDayTitle(dateKey)}</span>
      </div>
      <input
        id="task-detail-title-input"
        className="task-detail-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />

      <label className="task-detail-label" htmlFor="task-detail-note-input">
        备注
      </label>
      <textarea
        id="task-detail-note-input"
        className="task-detail-textarea"
        value={note}
        placeholder="添加备注..."
        rows={5}
        onChange={(event) => setNote(event.target.value)}
        onBlur={commitNote}
      />
    </section>
  );
}
