import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Task } from "../lib/types";
import { getTaskColorBg } from "../lib/taskColors";
import { TaskColorPicker } from "./TaskColorPicker";
import { Tooltip } from "./Tooltip";

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onRequestDelete: () => void;
  onRename: (title: string) => void;
  onColorChange: (colorId: string) => void;
}

export function TaskItem({
  task,
  onToggle,
  onRequestDelete,
  onRename,
  onColorChange,
}: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const titleRef = useRef<HTMLSpanElement>(null);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(task.title);
    }
  }, [task.title, editing]);

  useEffect(() => {
    setExpanded(false);
  }, [task.title]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el || expanded) {
      return;
    }

    const checkTruncation = () => {
      setIsTruncated(el.scrollHeight > el.clientHeight + 1);
    };

    checkTruncation();

    const observer = new ResizeObserver(checkTruncation);
    observer.observe(el);
    return () => observer.disconnect();
  }, [task.title, expanded]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const startEdit = () => {
    setExpanded(false);
    setDraft(task.title);
    setEditing(true);
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onRename(trimmed);
    } else {
      setDraft(task.title);
    }
    setEditing(false);
  };

  const handleTitleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;

      if (isTruncated && !expanded) {
        setExpanded(true);
        return;
      }

      if (expanded) {
        setExpanded(false);
        return;
      }

      startEdit();
    }, 200);
  };

  const handleTitleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    startEdit();
  };

  return (
    <li
      className={`task-item ${task.done ? "done" : ""}`}
      style={{ background: getTaskColorBg(task.color) }}
    >
      <Tooltip
        content={task.done ? "标记未完成" : "标记完成"}
        placement="top"
      >
        <button type="button" className="task-check" onClick={onToggle}>
          {task.done ? "☑" : "☐"}
        </button>
      </Tooltip>

      {editing ? (
        <input
          className="task-edit-input"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitEdit();
            if (event.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div
          className="task-title-wrap"
          onClick={handleTitleClick}
          onDoubleClick={handleTitleDoubleClick}
        >
          <span
            ref={titleRef}
            className={`task-title ${expanded ? "expanded" : ""}`}
          >
            {task.title}
          </span>
          {isTruncated && !expanded && (
            <span className="task-expand-hint">展开</span>
          )}
        </div>
      )}

      <TaskColorPicker colorId={task.color} onChange={onColorChange} />

      <Tooltip content="删除待办" placement="top">
        <button
          type="button"
          className="task-delete"
          onClick={onRequestDelete}
        >
          ×
        </button>
      </Tooltip>
    </li>
  );
}
