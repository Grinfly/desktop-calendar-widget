import { useEffect, useRef, useState } from "react";

import { getTaskColorDot, TASK_COLORS } from "../lib/taskColors";

import { Tooltip } from "./Tooltip";

interface TaskColorPickerProps {
  colorId?: string;
  onChange: (colorId: string) => void;
}

export function TaskColorPicker({ colorId = "", onChange }: TaskColorPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const currentDot = getTaskColorDot(colorId);

  return (
    <div className="task-color-picker" ref={rootRef}>
      <Tooltip content="选择行颜色" placement="top">
        <button
          type="button"
          className="task-color-trigger"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span
            className="task-color-swatch"
            style={{ background: currentDot }}
            aria-hidden="true"
          />
        </button>
      </Tooltip>

      {open && (
        <div className="task-color-menu" role="listbox" aria-label="待办行颜色">
          {TASK_COLORS.map((color) => {
            const selected = (colorId ?? "") === color.id;
            return (
              <Tooltip key={color.id || "default"} content={color.label} placement="top">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={color.label}
                  className={`task-color-option ${selected ? "selected" : ""}`}
                  onClick={() => {
                    onChange(color.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className="task-color-swatch task-color-swatch-menu"
                    style={{ background: color.dot }}
                    aria-hidden="true"
                  />
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
