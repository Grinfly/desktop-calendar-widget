import { useCallback, useEffect, useState } from "react";

import {
  getTodayMonth,
  parseDateKey,
  shiftMonth,
  toDateKey,
  toMonthKey,
} from "./lib/dates";
import { useDateTick } from "./hooks/useDateTick";
import { useTasks } from "./hooks/useTasks";
import { CalendarGrid } from "./components/CalendarGrid";
import { DatePickerPanel } from "./components/DatePickerPanel";
import { MonthSummaryPanel } from "./components/MonthSummaryPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { TaskList } from "./components/TaskList";
import { ResizeHandles } from "./components/ResizeHandles";
import { TitleBar } from "./components/TitleBar";
import { ExtensionProvider, useExtensions } from "./extensions/ExtensionContext";
import "./styles/global.css";

type PickerMode = "month" | "date" | "copy" | null;

function AppShell() {
  useDateTick();

  const {
    data,
    loaded,
    currentMonth,
    setCurrentMonth,
    view,
    selectDate,
    goToCalendar,
    togglePinMode,
    setBackgroundOpacity,
    setShowWorkRestBadges,
    addTask,
    toggleTask,
    deleteTask,
    updateTaskTitle,
    updateTaskColor,
    updateTaskNote,
    copyTasksFromDate,
    getTaskProgressOnDate,
    updateMonthSummary,
  } = useTasks();
  const { loaded: extensionsLoaded, manifests, getDaySubLabel, getDayBadge } =
    useExtensions();
  const dayBadge =
    (data.settings.showWorkRestBadges ?? true) &&
    manifests.some((manifest) => manifest.id === "lunar")
      ? getDayBadge
      : undefined;

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMonthSummary, setShowMonthSummary] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const closeDetail = useCallback(() => setDetailTaskId(null), []);
  const closeMonthSummary = useCallback(() => setShowMonthSummary(false), []);
  const openMonthSummary = useCallback(() => {
    setPickerMode(null);
    setShowSettings(false);
    setShowMonthSummary(true);
  }, []);

  useEffect(() => {
    if (!showSettings) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSettings(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSettings]);

  useEffect(() => {
    if (!showMonthSummary || showSettings || pickerMode !== null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMonthSummary(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showMonthSummary, showSettings, pickerMode]);

  useEffect(() => {
    if (view !== "tasks" || pickerMode !== null || showSettings) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (detailTaskId) {
          setDetailTaskId(null);
          return;
        }
        goToCalendar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, pickerMode, showSettings, detailTaskId, goToCalendar]);

  useEffect(() => {
    if (
      view !== "calendar" ||
      showSettings ||
      showMonthSummary ||
      pickerMode !== null
    ) {
      return;
    }

    let locked = false;
    let unlockTimer = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      if (locked) return;
      locked = true;
      setCurrentMonth((month) => shiftMonth(month, event.deltaY > 0 ? 1 : -1));
      unlockTimer = window.setTimeout(() => {
        locked = false;
      }, 520);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.clearTimeout(unlockTimer);
    };
  }, [view, showSettings, showMonthSummary, pickerMode, setCurrentMonth]);

  if (!loaded || !extensionsLoaded) {
    return (
      <div className="widget-shell loading">
        <div className="widget-card">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  const selectedDate = data.settings.selectedDate;
  const selectedTasks = selectedDate ? (data.tasks[selectedDate] ?? []) : [];
  const selectedDateObj = selectedDate ? parseDateKey(selectedDate) : undefined;
  const showTaskView = view === "tasks" && Boolean(selectedDate);
  const yesterdayKey = selectedDate
    ? (() => {
        const yesterday = parseDateKey(selectedDate);
        yesterday.setDate(yesterday.getDate() - 1);
        return toDateKey(yesterday);
      })()
    : null;
  const canCopyYesterday = Boolean(
    yesterdayKey && (data.tasks[yesterdayKey]?.length ?? 0) > 0,
  );

  const closePicker = () => setPickerMode(null);
  const openSettings = () => {
    setPickerMode(null);
    setShowSettings(true);
  };
  const openMonthSummaryFromBar =
    !showSettings && pickerMode !== "month" ? openMonthSummary : undefined;
  const closeSettings = () => setShowSettings(false);
  const goToTodayMonth = () => {
    setCurrentMonth(getTodayMonth());
    setPickerMode(null);
    setShowSettings(false);
  };

  const mainContent = showSettings ? (
    <SettingsPanel
      backgroundOpacity={data.settings.backgroundOpacity ?? 100}
      onBackgroundOpacityChange={setBackgroundOpacity}
      showWorkRestBadges={data.settings.showWorkRestBadges ?? true}
      onShowWorkRestBadgesChange={setShowWorkRestBadges}
      onClose={closeSettings}
    />
  ) : showTaskView ? (
    pickerMode === "date" || pickerMode === "copy" ? (
      <DatePickerPanel
        mode="date"
        anchorDate={selectedDateObj ?? currentMonth}
        selectedDate={selectedDateObj}
        onSelectMonth={setCurrentMonth}
        onSelectDate={(date) => {
          if (pickerMode === "copy" && selectedDate) {
            copyTasksFromDate(toDateKey(date), selectedDate);
            closePicker();
            return;
          }
          selectDate(date);
        }}
        getDaySubLabel={getDaySubLabel}
        getDayBadge={dayBadge}
        onClose={closePicker}
      />
    ) : (
      <TaskList
        dateKey={selectedDate}
        tasks={selectedTasks}
        detailTaskId={detailTaskId}
        onOpenDetail={setDetailTaskId}
        onCloseDetail={closeDetail}
        onAdd={(title) => addTask(selectedDate, title)}
        onToggle={(taskId) => toggleTask(selectedDate, taskId)}
        onDelete={(taskId) => deleteTask(selectedDate, taskId)}
        onRename={(taskId, title) =>
          updateTaskTitle(selectedDate, taskId, title)
        }
        onNoteChange={(taskId, note) =>
          updateTaskNote(selectedDate, taskId, note)
        }
        onColorChange={(taskId, colorId) =>
          updateTaskColor(selectedDate, taskId, colorId)
        }
        onCopyYesterday={() => {
          if (!canCopyYesterday || !yesterdayKey) return;
          copyTasksFromDate(yesterdayKey, selectedDate);
        }}
        canCopyYesterday={canCopyYesterday}
        onCopyFromDate={() => setPickerMode("copy")}
      />
    )
  ) : pickerMode === "month" ? (
    <DatePickerPanel
      mode="month"
      anchorDate={currentMonth}
      onSelectMonth={setCurrentMonth}
      getDaySubLabel={getDaySubLabel}
      getDayBadge={dayBadge}
      onClose={closePicker}
    />
  ) : showMonthSummary ? (
    <MonthSummaryPanel
      key={toMonthKey(currentMonth)}
      month={currentMonth}
      tasks={data.tasks}
      summary={(data.monthSummaries ?? {})[toMonthKey(currentMonth)] ?? ""}
      onSummaryChange={(text) =>
        updateMonthSummary(toMonthKey(currentMonth), text)
      }
    />
  ) : (
    <CalendarGrid
      month={currentMonth}
      getTaskProgressOnDate={getTaskProgressOnDate}
      getDaySubLabel={getDaySubLabel}
      getDayBadge={dayBadge}
      onSelectDate={selectDate}
    />
  );

  return (
    <div className="widget-shell">
      <ResizeHandles />
      <div className="widget-card">
        {showTaskView ? (
          <>
            <TitleBar
              month={currentMonth}
              pinMode={data.settings.pinMode}
              onPinToggle={() => void togglePinMode()}
              onOpenSettings={openSettings}
              settingsOpen={showSettings}
              showMonthNav={false}
              dateKey={selectedDate}
              detailOpen={Boolean(detailTaskId)}
              onBack={
                showSettings
                  ? closeSettings
                  : pickerMode === "date" || pickerMode === "copy"
                    ? closePicker
                    : detailTaskId
                      ? closeDetail
                      : goToCalendar
              }
              onOpenDatePicker={() => {
                setShowSettings(false);
                setDetailTaskId(null);
                setPickerMode("date");
              }}
            />
            {mainContent}
          </>
        ) : (
          <>
            <TitleBar
              month={currentMonth}
              pinMode={data.settings.pinMode}
              onPinToggle={() => void togglePinMode()}
              onOpenSettings={openSettings}
              settingsOpen={showSettings}
              onBack={
                showSettings
                  ? closeSettings
                  : pickerMode === "month"
                    ? closePicker
                    : showMonthSummary
                      ? closeMonthSummary
                      : undefined
              }
              onOpenPicker={() => {
                setShowSettings(false);
                setPickerMode("month");
              }}
              onDoubleClick={() => {
                if (selectedDate) {
                  setShowMonthSummary(false);
                  selectDate(new Date(selectedDate));
                }
              }}
              onGoToTodayMonth={goToTodayMonth}
              onOpenMonthSummary={openMonthSummaryFromBar}
              monthSummaryOpen={showMonthSummary}
            />
            {mainContent}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ExtensionProvider>
      <AppShell />
    </ExtensionProvider>
  );
}
