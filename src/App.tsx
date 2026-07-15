import { useEffect, useState } from "react";

import { getTodayMonth, parseDateKey } from "./lib/dates";
import { useDateTick } from "./hooks/useDateTick";
import { useTasks } from "./hooks/useTasks";
import { CalendarGrid } from "./components/CalendarGrid";
import { DatePickerPanel } from "./components/DatePickerPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { TaskList } from "./components/TaskList";
import { ResizeHandles } from "./components/ResizeHandles";
import { TitleBar } from "./components/TitleBar";
import "./styles/global.css";

type PickerMode = "month" | "date" | null;

function App() {
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
    getTaskProgressOnDate,
  } = useTasks();

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [showSettings, setShowSettings] = useState(false);

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
    if (view !== "tasks" || pickerMode !== null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        goToCalendar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, pickerMode, goToCalendar]);

  if (!loaded) {
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
    pickerMode === "date" ? (
      <DatePickerPanel
        mode="date"
        anchorDate={selectedDateObj ?? currentMonth}
        selectedDate={selectedDateObj}
        onSelectMonth={setCurrentMonth}
        onSelectDate={selectDate}
        onClose={closePicker}
      />
    ) : (
      <TaskList
        dateKey={selectedDate}
        tasks={selectedTasks}
        onAdd={(title) => addTask(selectedDate, title)}
        onToggle={(taskId) => toggleTask(selectedDate, taskId)}
        onDelete={(taskId) => deleteTask(selectedDate, taskId)}
        onRename={(taskId, title) =>
          updateTaskTitle(selectedDate, taskId, title)
        }
        onColorChange={(taskId, colorId) =>
          updateTaskColor(selectedDate, taskId, colorId)
        }
      />
    )
  ) : pickerMode === "month" ? (
    <DatePickerPanel
      mode="month"
      anchorDate={currentMonth}
      onSelectMonth={setCurrentMonth}
      onClose={closePicker}
    />
  ) : (
    <CalendarGrid
      month={currentMonth}
      getTaskProgressOnDate={getTaskProgressOnDate}
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
              onBack={
                showSettings
                  ? closeSettings
                  : pickerMode === "date"
                    ? closePicker
                    : goToCalendar
              }
              onOpenDatePicker={() => {
                setShowSettings(false);
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

export default App;
