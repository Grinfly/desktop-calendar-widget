import type { CSSProperties } from "react";

import { isSameMonth, isToday, toDateKey } from "../lib/dates";
import type { TaskProgress } from "../lib/types";

interface DayCellProps {
  date: Date;
  currentMonth: Date;
  taskProgress: TaskProgress | null;
  getDaySubLabel?: (date: Date) => string | undefined;
  onSelect: (date: Date) => void;
}

function formatTaskAriaLabel(progress: TaskProgress): string {
  return `，${progress.total}项待办，已完成${progress.done}项`;
}

export function DayCell({
  date,
  currentMonth,
  taskProgress,
  getDaySubLabel,
  onSelect,
}: DayCellProps) {
  const inMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);
  const subLabel = getDaySubLabel?.(date);
  const lunarAria = subLabel ? `，${subLabel}` : "";

  return (
    <button
      type="button"
      className={[
        "day-cell",
        inMonth ? "in-month" : "out-month",
        today ? "today" : "",
        taskProgress ? "has-tasks" : "",
        subLabel ? "has-sub-label" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(date)}
      aria-label={`${toDateKey(date)}${lunarAria}${taskProgress ? formatTaskAriaLabel(taskProgress) : ""}`}
      disabled={!inMonth}
    >
      <span className="day-cell-main">
        <span className="day-number">{date.getDate()}</span>
        {subLabel ? (
          <span className="day-sub-label" aria-hidden="true">
            {subLabel}
          </span>
        ) : null}
        {taskProgress && (
          <span
            className="task-mark"
            style={
              {
                "--done-ratio": taskProgress.done / taskProgress.total,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
}
