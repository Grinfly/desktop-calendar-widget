import { useEffect, useState } from "react";

import {
  formatYearTitle,
  getCalendarDays,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  isToday,
  makeMonthDate,
  MONTH_LABELS,
  toDateKey,
  WEEKDAY_LABELS,
  withYearMonth,
} from "../lib/dates";
import { getDaySubLabel } from "../lib/holidays";
import { Tooltip } from "./Tooltip";

type PickerMode = "month" | "date";

interface DatePickerPanelProps {
  mode: PickerMode;
  anchorDate: Date;
  selectedDate?: Date;
  onSelectMonth: (date: Date) => void;
  onSelectDate?: (date: Date) => void;
  onClose: () => void;
}

export function DatePickerPanel({
  mode,
  anchorDate,
  selectedDate,
  onSelectMonth,
  onSelectDate,
  onClose,
}: DatePickerPanelProps) {
  const [viewYear, setViewYear] = useState(getYear(anchorDate));
  const [viewMonth, setViewMonth] = useState(getMonth(anchorDate));

  useEffect(() => {
    setViewYear(getYear(anchorDate));
    setViewMonth(getMonth(anchorDate));
  }, [anchorDate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const viewMonthDate = makeMonthDate(viewYear, viewMonth);
  const dayGrid = mode === "date" ? getCalendarDays(viewMonthDate) : [];

  const handleMonthPick = (monthIndex: number) => {
    const next = makeMonthDate(viewYear, monthIndex);
    if (mode === "month") {
      onSelectMonth(next);
      onClose();
      return;
    }
    setViewMonth(monthIndex);
  };

  const handleDayPick = (day: Date) => {
    if (!isSameMonth(day, viewMonthDate)) return;
    onSelectDate?.(day);
    onSelectMonth(withYearMonth(day, viewYear, getMonth(day)));
    onClose();
  };

  return (
    <section className="date-picker-panel" aria-label="日期选择">
      <div className="picker-toolbar">
        <Tooltip content="上一年">
          <button
            type="button"
            className="nav-button"
            onClick={() => setViewYear((year) => year - 1)}
          >
            ◀
          </button>
        </Tooltip>
        <Tooltip content="跳转到今年">
          <button
            type="button"
            className="picker-year-button"
            onClick={() => setViewYear(new Date().getFullYear())}
          >
            {formatYearTitle(viewYear)}
          </button>
        </Tooltip>
        <Tooltip content="下一年">
          <button
            type="button"
            className="nav-button"
            onClick={() => setViewYear((year) => year + 1)}
          >
            ▶
          </button>
        </Tooltip>
      </div>

      <div className="picker-month-grid">
        {MONTH_LABELS.map((label, index) => {
          const isCurrent =
            mode === "month"
              ? getYear(anchorDate) === viewYear &&
                getMonth(anchorDate) === index
              : viewMonth === index;
          return (
            <button
              key={label}
              type="button"
              className={`picker-month-cell ${isCurrent ? "active" : ""}`}
              onClick={() => handleMonthPick(index)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {mode === "date" && (
        <div className="picker-day-section">
          <div className="weekday-row">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="weekday-label">
                {label}
              </span>
            ))}
          </div>
          <div className="days-grid picker-days-grid">
            {dayGrid.map((day) => {
              const inMonth = isSameMonth(day, viewMonthDate);
              const selected =
                selectedDate !== undefined && isSameDay(day, selectedDate);
              const subLabel = getDaySubLabel(day);
              return (
                <button
                  key={toDateKey(day)}
                  type="button"
                  className={[
                    "day-cell",
                    "picker-day-cell",
                    inMonth ? "in-month" : "out-month",
                    isToday(day) ? "today" : "",
                    selected ? "selected" : "",
                    "has-sub-label",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleDayPick(day)}
                  disabled={!inMonth}
                >
                  <span className="day-cell-main">
                    <span className="day-number">{day.getDate()}</span>
                    <span className="day-sub-label" aria-hidden="true">
                      {subLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
