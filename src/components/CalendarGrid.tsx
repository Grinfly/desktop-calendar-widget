import { getCalendarDays, toDateKey, WEEKDAY_LABELS } from "../lib/dates";
import type { TaskProgress } from "../lib/types";
import { DayCell } from "./DayCell";

interface CalendarGridProps {
  month: Date;
  getTaskProgressOnDate: (dateKey: string) => TaskProgress | null;
  onSelectDate: (date: Date) => void;
}

export function CalendarGrid({
  month,
  getTaskProgressOnDate,
  onSelectDate,
}: CalendarGridProps) {
  const days = getCalendarDays(month);

  return (
    <section className="calendar-grid" aria-label="月历">
      <div className="weekday-row">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="weekday-label">
            {label}
          </span>
        ))}
      </div>
      <div className="days-grid">
        {days.map((day) => (
          <DayCell
            key={toDateKey(day)}
            date={day}
            currentMonth={month}
            taskProgress={getTaskProgressOnDate(toDateKey(day))}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </section>
  );
}
