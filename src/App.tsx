import { useCallback, useEffect, useState } from "react";

import { getTodayMonth, parseDateKey, toDateKey } from "./lib/dates";
import { useDateTick } from "./hooks/useDateTick";
import { useTasks } from "./hooks/useTasks";
import { CalendarGrid } from "./components/CalendarGrid";
import { DatePickerPanel } from "./components/DatePickerPanel";
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
    addTask,
    toggleTask,
    deleteTask,
    updateTaskTitle,
    updateTaskColor,
    updateTaskNote,
    copyTasksFromDate,
    getTaskProgressOnDate,
  } = useTasks();
  const { loaded: extensionsLoaded, getDaySubLabel } = useExtensions();

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const closeDetail = useCallback(() => setDetailTaskId(null), []);

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
      onClose={closePicker}
    />
  ) : (
    <CalendarGrid
      month={currentMonth}
      getTaskProgressOnDate={getTaskProgressOnDate}
      getDaySubLabel={getDaySubLabel}
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
                    : undefined
              }
              onOpenPicker={() => {
                setShowSettings(false);
                setPickerMode("month");
              }}
              onDoubleClick={() => {
                if (selectedDate) selectDate(new Date(selectedDate));
              }}
              onGoToTodayMonth={goToTodayMonth}
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
