import { useLayoutEffect, useRef } from "react";

import {
  formatDayTitle,
  formatMonthTitle,
  isSameMonth,
  toMonthKey,
} from "../lib/dates";
import type { PinMode } from "../lib/types";
import { MonthSummaryButton } from "./MonthSummaryButton";
import { PinButton } from "./PinButton";
import { SettingsButton } from "./SettingsButton";
import { TodayMonthButton } from "./TodayMonthButton";
import { Tooltip } from "./Tooltip";

interface TitleBarProps {
  month: Date;
  pinMode: PinMode;
  onPinToggle: () => void;
  onOpenSettings: () => void;
  settingsOpen?: boolean;
  onOpenPicker?: () => void;
  onDoubleClick?: () => void;
  showMonthNav?: boolean;
  dateKey?: string;
  detailOpen?: boolean;
  onBack?: () => void;
  onOpenDatePicker?: () => void;
  onGoToTodayMonth?: () => void;
  onOpenMonthSummary?: () => void;
  monthSummaryOpen?: boolean;
}

export function TitleBar({
  month,
  pinMode,
  onPinToggle,
  onOpenSettings,
  settingsOpen = false,
  onOpenPicker,
  onDoubleClick,
  showMonthNav = true,
  dateKey,
  detailOpen = false,
  onBack,
  onOpenDatePicker,
  onGoToTodayMonth,
  onOpenMonthSummary,
  monthSummaryOpen = false,
}: TitleBarProps) {
  const isTaskView = !showMonthNav && dateKey !== undefined;
  const showBack = Boolean(onBack);
  const isTodayMonth = isSameMonth(month, new Date());
  const monthKey = toMonthKey(month);
  const prevMonthKey = useRef(monthKey);
  const monthSlide =
    monthKey === prevMonthKey.current
      ? ""
      : monthKey > prevMonthKey.current
        ? "next"
        : "prev";
  useLayoutEffect(() => {
    prevMonthKey.current = monthKey;
  }, [monthKey]);

  const backButton = showBack ? (
    <Tooltip content="返回">
      <button
        type="button"
        className="nav-button back-arrow"
        onClick={onBack}
        onMouseDown={(event) => event.stopPropagation()}
      >
        &lt;
      </button>
    </Tooltip>
  ) : null;

  return (
    <header className="title-bar">
      {showMonthNav ? (
        <>
          <div
            className="title-bar-left"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {backButton}
            <Tooltip content="选择年月">
              <button
                type="button"
                className="title-bar-label title-bar-picker"
                onClick={onOpenPicker}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <span
                  key={monthKey}
                  className={`title-month-text${monthSlide ? ` title-month-${monthSlide}` : ""}`}
                >
                  {formatMonthTitle(month)}
                </span>
              </button>
            </Tooltip>
            {onOpenMonthSummary ? (
              <MonthSummaryButton
                active={monthSummaryOpen}
                onOpen={onOpenMonthSummary}
              />
            ) : null}
          </div>
        </>
      ) : isTaskView ? (
        <div
          className="title-bar-left"
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {backButton}
          {detailOpen ? (
            <span className="title-bar-label single">待办详情</span>
          ) : (
            <Tooltip content="选择日期">
              <button
                type="button"
                className="title-bar-label title-bar-picker"
                onClick={onOpenDatePicker}
                onMouseDown={(event) => event.stopPropagation()}
              >
                {formatDayTitle(dateKey)}
              </button>
            </Tooltip>
          )}
        </div>
      ) : (
        <div
          className="title-bar-left"
          onDoubleClick={(event) => event.stopPropagation()}
        />
      )}
      <div
        className="title-bar-drag-area"
        aria-hidden="true"
        onDoubleClick={onDoubleClick}
      />
      <div
        className="title-bar-actions"
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {showMonthNav && onGoToTodayMonth ? (
          <TodayMonthButton
            active={isTodayMonth}
            onGoToTodayMonth={onGoToTodayMonth}
          />
        ) : null}
        <PinButton mode={pinMode} onToggle={onPinToggle} />
        <SettingsButton active={settingsOpen} onOpen={onOpenSettings} />
      </div>
    </header>
  );
}
