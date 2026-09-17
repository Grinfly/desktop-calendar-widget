import type { CSSProperties } from "react";

import type { DayBadge } from "../extensions/types";
import { isSameMonth, isToday, toDateKey } from "../lib/dates";
import type { TaskProgress } from "../lib/types";

interface DayCellProps {
  date: Date;
  currentMonth: Date;
  taskProgress: TaskProgress | null;
  getDaySubLabel?: (date: Date) => string | undefined;
  getDayBadge?: (date: Date) => DayBadge | undefined;
  onSelect: (date: Date) => void;
}

function formatTaskAriaLabel(progress: TaskProgress): string {
  return `，${progress.total}项待办，已完成${progress.done}项`;
}

function formatBadgeAriaLabel(badge: DayBadge): string {
  return badge === "work" ? "，调休上班" : "，放假";
}

export function DayBadgeMark({ badge }: { badge: DayBadge | undefined }) {
  if (!badge) return null;
  return (
    <span className={`day-badge day-badge-${badge}`} aria-hidden="true">
      <span className="day-badge-dot" />
      <span className="day-badge-label">{badge === "work" ? "班" : "休"}</span>
    </span>
  );
}

export function DayCell({
  date,
  currentMonth,
  taskProgress,
  getDaySubLabel,
  getDayBadge,
  onSelect,
}: DayCellProps) {
  const inMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);
  const subLabel = getDaySubLabel?.(date);
  const badge = getDayBadge?.(date);
  const lunarAria = subLabel ? `，${subLabel}` : "";
  const badgeAria = badge ? formatBadgeAriaLabel(badge) : "";

  return (
    <button
      type="button"
      className={[
        "day-cell",
        inMonth ? "in-month" : "out-month",
        today ? "today" : "",
        taskProgress ? "has-tasks" : "",
        subLabel ? "has-sub-label" : "",
        badge === "rest" ? "holiday-rest" : "",
        badge === "work" ? "holiday-work" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(date)}
      aria-label={`${toDateKey(date)}${lunarAria}${badgeAria}${taskProgress ? formatTaskAriaLabel(taskProgress) : ""}`}
      disabled={!inMonth}
    >
      <DayBadgeMark badge={badge} />
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
