import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { v4 as uuidv4 } from "uuid";

import { parseDateKey, toDateKey } from "../lib/dates";
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
      const restoreTasks =
        saved.settings.lastView === "tasks" && hasSelectedDate;
      setView(restoreTasks ? "tasks" : "calendar");
      // Calendar view should open on today's month; only sync month when
      // resuming a previous task date (which may be in another month).
      if (restoreTasks) {
        setCurrentMonth(parseDateKey(saved.settings.selectedDate));
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

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<PinMode>("pin-mode-changed", (event) => {
      const mode = event.payload;
      if (mode !== "floating" && mode !== "normal" && mode !== "desktop") {
        return;
      }
      updateData((prev) => {
        if (prev.settings.pinMode === mode) return prev;
        return {
          ...prev,
          settings: { ...prev.settings, pinMode: mode },
        };
      });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [updateData]);

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
    // Title-bar pin only toggles always-on-top vs normal (both draggable).
    // Desktop-stick is a separate tray action.
    const next: PinMode =
      data.settings.pinMode === "floating" ? "normal" : "floating";

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

  const updateTaskNote = useCallback(
    (dateKey: string, taskId: string, note: string) => {
      updateData((prev) => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [dateKey]: (prev.tasks[dateKey] ?? []).map((task) =>
            task.id === taskId ? { ...task, note } : task,
          ),
        },
      }));
    },
    [updateData],
  );

  const copyTasksFromDate = useCallback(
    (fromDateKey: string, toDateKey: string) => {
      if (fromDateKey === toDateKey) return;

      updateData((prev) => {
        const source = prev.tasks[fromDateKey] ?? [];
        if (source.length === 0) return prev;

        const copied: Task[] = source.map((task) => ({
          ...task,
          id: uuidv4(),
        }));

        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [toDateKey]: [...(prev.tasks[toDateKey] ?? []), ...copied],
          },
        };
      });
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
    updateTaskNote,
    copyTasksFromDate,
    getTaskProgressOnDate,
  };
}
