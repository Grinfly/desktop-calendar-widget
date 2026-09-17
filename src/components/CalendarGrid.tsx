import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { DayBadge } from "../extensions/types";
import { getCalendarDays, toDateKey, toMonthKey, WEEKDAY_LABELS } from "../lib/dates";
import type { TaskProgress } from "../lib/types";
import { DayCell } from "./DayCell";

interface CalendarGridProps {
  month: Date;
  getTaskProgressOnDate: (dateKey: string) => TaskProgress | null;
  getDaySubLabel?: (date: Date) => string | undefined;
  getDayBadge?: (date: Date) => DayBadge | undefined;
  onSelectDate: (date: Date) => void;
}

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

function DaysGrid({
  month,
  getTaskProgressOnDate,
  getDaySubLabel,
  getDayBadge,
  onSelectDate,
}: {
  month: Date;
  getTaskProgressOnDate: (dateKey: string) => TaskProgress | null;
  getDaySubLabel?: (date: Date) => string | undefined;
  getDayBadge?: (date: Date) => DayBadge | undefined;
  onSelectDate: (date: Date) => void;
}) {
  const days = getCalendarDays(month);
  return (
    <div className="days-grid">
      {days.map((day) => (
        <DayCell
          key={`${toMonthKey(month)}-${toDateKey(day)}`}
          date={day}
          currentMonth={month}
          taskProgress={getTaskProgressOnDate(toDateKey(day))}
          getDaySubLabel={getDaySubLabel}
          getDayBadge={getDayBadge}
          onSelect={onSelectDate}
        />
      ))}
    </div>
  );
}

export function CalendarGrid({
  month,
  getTaskProgressOnDate,
  getDaySubLabel,
  getDayBadge,
  onSelectDate,
}: CalendarGridProps) {
  const targetKey = toMonthKey(month);
  const [display, setDisplay] = useState(month);
  const [anim, setAnim] = useState<{
    from: Date;
    to: Date;
    dir: 1 | -1;
    phase: "prepare" | "run";
  } | null>(null);
  const animRef = useRef(anim);
  animRef.current = anim;

  const displayKey = toMonthKey(display);
  const dayProps = {
    getTaskProgressOnDate,
    getDaySubLabel,
    getDayBadge,
    onSelectDate,
  };

  const finish = useCallback(() => {
    const current = animRef.current;
    if (!current) return;
    setDisplay(current.to);
    setAnim(null);
  }, []);

  useLayoutEffect(() => {
    if (anim) return;
    if (targetKey === displayKey) return;

    const diff = monthIndex(month) - monthIndex(display);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || Math.abs(diff) !== 1) {
      setDisplay(month);
      return;
    }

    setAnim({
      from: display,
      to: month,
      dir: diff > 0 ? 1 : -1,
      phase: "prepare",
    });
  }, [anim, display, displayKey, month, targetKey]);

  useLayoutEffect(() => {
    if (anim?.phase !== "prepare") return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        setAnim((current) =>
          current?.phase === "prepare" ? { ...current, phase: "run" } : current,
        );
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [anim]);

  useEffect(() => {
    if (anim?.phase !== "run") return;
    const timer = window.setTimeout(finish, 640);
    return () => window.clearTimeout(timer);
  }, [anim, finish]);

  const sliding = Boolean(anim);
  const running = anim?.phase === "run";
  const dir = anim?.dir ?? 1;
  const from = anim?.from ?? display;
  const to = anim?.to ?? display;
  const translate =
    !sliding || dir === 1
      ? running
        ? "-50%"
        : "0"
      : running
        ? "0"
        : "-50%";

  return (
    <section className="calendar-grid" aria-label="月历">
      <div className="weekday-row">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="weekday-label">
            {label}
          </span>
        ))}
      </div>
      <div className="days-viewport">
        <div
          className={["days-track", running ? "is-sliding" : ""].filter(Boolean).join(" ")}
          data-wide={sliding ? "true" : "false"}
          style={{ transform: `translate3d(${translate}, 0, 0)` }}
          onTransitionEnd={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.propertyName !== "transform") return;
            finish();
          }}
        >
          {sliding ? (
            dir === 1 ? (
              <>
                <DaysGrid month={from} {...dayProps} />
                <DaysGrid month={to} {...dayProps} />
              </>
            ) : (
              <>
                <DaysGrid month={to} {...dayProps} />
                <DaysGrid month={from} {...dayProps} />
              </>
            )
          ) : (
            <DaysGrid month={display} {...dayProps} />
          )}
        </div>
      </div>
    </section>
  );
}
