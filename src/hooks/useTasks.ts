import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { toDateKey } from "../lib/dates";
import { loadAppData, saveAppData } from "../lib/storage";
import { applyBackgroundOpacity, setPinMode } from "../lib/windowTheme";
import {
  DEFAULT_APP_DATA,
  type AppData,
  type AppSettings,
  type AppView,
  type PinMode,
  type Task,
} from "../lib/types";

const SAVE_DEBOUNCE_MS = 300;

export function useTasks() {
  const [data, setData] = useState<AppData>(DEFAULT_APP_DATA);
  const [loaded, setLoaded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<AppView>("calendar");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((next: AppData) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      void saveAppData(next);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const updateData = useCallback(
    (updater: (prev: AppData) => AppData) => {
      setData((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const saved = await loadAppData();
      if (!active) return;

      setData(saved);
      const hasSelectedDate = Boolean(saved.settings.selectedDate);
      setView(
        saved.settings.lastView === "tasks" && hasSelectedDate
          ? "tasks"
          : "calendar",
      );
      if (saved.settings.selectedDate) {
        setCurrentMonth(new Date(saved.settings.selectedDate));
      }
      void applyBackgroundOpacity(saved.settings.backgroundOpacity ?? 100);
      setLoaded(true);
    })();

    return () => {
      active = false;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      updateData((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
    },
    [updateData],
  );

  const selectDate = useCallback(
    (date: Date) => {
      const key = toDateKey(date);
      updateSettings({ selectedDate: key, lastView: "tasks" });
      setView("tasks");
    },
    [updateSettings],
  );

  const goToCalendar = useCallback(() => {
    updateSettings({ lastView: "calendar" });
    setView("calendar");
  }, [updateSettings]);

  const togglePinMode = useCallback(() => {
    const next: PinMode =
      data.settings.pinMode === "floating" ? "desktop" : "floating";

    updateSettings({ pinMode: next });
    void setPinMode(next).catch((error) => {
      console.error("切换钉住模式失败", error);
    });
  }, [data.settings.pinMode, updateSettings]);

  const setBackgroundOpacity = useCallback(
    (opacity: number) => {
      const clamped = Math.min(100, Math.max(20, Math.round(opacity)));
      updateSettings({ backgroundOpacity: clamped });
      void applyBackgroundOpacity(clamped);
    },
    [updateSettings],
  );

  const addTask = useCallback(
    (dateKey: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      const task: Task = {
        id: uuidv4(),
        title: trimmed,
        done: false,
        note: "",
      };

      updateData((prev) => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [dateKey]: [...(prev.tasks[dateKey] ?? []), task],
        },
      }));
    },
    [updateData],
  );

  const toggleTask = useCallback(
    (dateKey: string, taskId: string) => {
      updateData((prev) => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [dateKey]: (prev.tasks[dateKey] ?? []).map((task) =>
            task.id === taskId ? { ...task, done: !task.done } : task,
          ),
        },
      }));
    },
    [updateData],
  );

  const deleteTask = useCallback(
    (dateKey: string, taskId: string) => {
      updateData((prev) => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [dateKey]: (prev.tasks[dateKey] ?? []).filter(
            (task) => task.id !== taskId,
          ),
        },
      }));
    },
    [updateData],
  );

  const updateTaskTitle = useCallback(
    (dateKey: string, taskId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      updateData((prev) => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [dateKey]: (prev.tasks[dateKey] ?? []).map((task) =>
            task.id === taskId ? { ...task, title: trimmed } : task,
          ),
        },
      }));
    },
    [updateData],
  );

  const updateTaskColor = useCallback(
    (dateKey: string, taskId: string, colorId: string) => {
      updateData((prev) => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [dateKey]: (prev.tasks[dateKey] ?? []).map((task) =>
            task.id === taskId ? { ...task, color: colorId || undefined } : task,
          ),
        },
      }));
    },
    [updateData],
  );

  const getTaskProgressOnDate = useCallback(
    (dateKey: string) => {
      const tasks = data.tasks[dateKey];
      if (!tasks?.length) return null;
      const done = tasks.filter((task) => task.done).length;
      return { total: tasks.length, done };
    },
    [data.tasks],
  );

  return {
    data,
    loaded,
    currentMonth,
    setCurrentMonth,
    view,
    setView,
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
  };
}
