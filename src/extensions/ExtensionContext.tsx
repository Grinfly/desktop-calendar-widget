import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
  type ReactNode,
} from "react";
import type { useTasks } from "../hooks/useTasks";
import { toDateKey } from "../lib/dates";
import { diffTasks, listExtensionTasks } from "./taskApi";
import {
  importExtensionModule, installExtension, listExtensions, loadWorkRestDays,
  uninstallExtension, withHostBadges,
} from "./loader";
import { ExtensionRuntime, type ExtensionState, type RegisteredPanel } from "./runtime";
import type { DayAtmosphere, DayBadge, ExtensionManifest, ExtensionTask, WorldEvent } from "./types";

interface ExtensionContextValue {
  loaded: boolean;
  manifests: ExtensionManifest[];
  states: ExtensionState[];
  panels: RegisteredPanel[];
  hasDayBadges: boolean;
  getDaySubLabel: (date: Date) => string | undefined;
  getDayBadge: (date: Date) => DayBadge | undefined;
  getDayAtmosphere: (date: Date) => DayAtmosphere | undefined;
  worldEvent: WorldEvent | undefined;
  mountPanel: (panel: RegisteredPanel, container: HTMLElement) => () => void;
  install: () => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  busy: boolean;
  error: string | null;
}

const ExtensionContext = createContext<ExtensionContextValue | null>(null);
const none = () => undefined;
const noMount = () => () => {};

export function ExtensionProvider({ children, tasks }: {
  children: ReactNode;
  tasks: ReturnType<typeof useTasks>;
}) {
  const host = useRef(tasks);
  host.current = tasks;
  const [runtime, setRuntime] = useState<ExtensionRuntime | null>(null);
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  const [loaded, setLoaded] = useState(false);
  const [hostDays, setHostDays] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const previousTasks = useRef<ExtensionTask[] | null>(null);

  useEffect(() => {
    if (!tasks.loaded) return;
    let active = true;
    const instance = new ExtensionRuntime({
      listTasks: (dateKey) => listExtensionTasks(host.current.data, dateKey),
      writeTask: (command) => host.current.extensionCommand(command),
    }, localStorage, importExtensionModule, () => { if (active) refresh(); });
    setRuntime(instance);
    setLoaded(false);
    void (async () => {
      try {
        const manifests = await listExtensions();
        if (active) await instance.start(manifests);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (active) setLoaded(true);
      }
    })();
    const refreshBadges = () => {
      void loadWorkRestDays().then((days) => { if (active) setHostDays(days); }).catch(() => {});
    };
    refreshBadges();
    let lastDate = toDateKey(new Date());
    const tick = () => {
      const dateKey = toDateKey(new Date());
      if (dateKey !== lastDate) {
        lastDate = dateKey;
        instance.emit("date:changed", { dateKey });
        refreshBadges();
      }
      refresh();
    };
    const visibility = () => {
      instance.emit("visibility:changed", { visible: document.visibilityState === "visible" });
      tick();
    };
    // 兼容已发布的旧版世界事件扩展。
    window.addEventListener("world-event-change", tick);
    document.addEventListener("visibilitychange", visibility);
    const interval = window.setInterval(tick, 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("world-event-change", tick);
      document.removeEventListener("visibilitychange", visibility);
      instance.dispose();
    };
  }, [tasks.loaded]);

  useEffect(() => {
    if (!tasks.loaded) return;
    const next = listExtensionTasks(tasks.data);
    const previous = previousTasks.current;
    previousTasks.current = next;
    if (!previous || !runtime) return;
    const changes = diffTasks(previous, next);
    if (!changes.length) return;
    runtime.emit("tasks:changed", { changes });
    for (const change of changes) {
      if (change.type === "updated" && !change.before?.task.done && change.after?.task.done) {
        runtime.emit("task:completed", change.after);
      }
    }
  }, [tasks.loaded, tasks.data.tasks, tasks.data.longTermTasks, runtime]);

  const runOperation = useCallback(async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { operation.current = false; setBusy(false); }
  }, []);

  const install = useCallback(() => runOperation(async () => {
    const installed = await installExtension();
    if (installed) {
      await host.current.flush();
      runtime?.dispose();
      window.location.reload();
    }
  }), [runtime, runOperation]);

  const uninstall = useCallback((id: string) => runOperation(async () => {
    await host.current.flush();
    await uninstallExtension(id);
    runtime?.dispose();
    window.location.reload();
  }), [runtime, runOperation]);

  const setEnabled = useCallback((id: string, enabled: boolean) => runOperation(async () => {
    const state = runtime?.states.find((item) => item.manifest.id === id);
    if (!state || !runtime) return;
    const legacy = state.manifest.apiVersion === undefined;
    if (legacy) await host.current.flush();
    await runtime.setEnabled(id, enabled, !legacy);
    // 旧扩展可能直接创建全局计时器，只能通过重载确保彻底停止。
    if (legacy) { runtime.dispose(); window.location.reload(); }
  }), [runtime, runOperation]);

  const value = useMemo<ExtensionContextValue>(() => {
    const states = runtime?.states ?? [];
    return {
      loaded,
      manifests: states.map((state) => state.manifest),
      states,
      panels: runtime?.panels ?? [],
      hasDayBadges: runtime?.hasDayBadges ?? false,
      getDaySubLabel: runtime?.getDaySubLabel ?? none,
      getDayBadge: withHostBadges(hostDays, runtime?.getDayBadge ?? none),
      getDayAtmosphere: runtime?.getDayAtmosphere ?? none,
      worldEvent: runtime?.getWorldEvent(),
      mountPanel: runtime ? (panel, container) => runtime.mountPanel(panel, container) : noMount,
      install, uninstall, setEnabled, busy, error,
    };
  }, [runtime, revision, loaded, hostDays, install, uninstall, setEnabled, busy, error]);

  return <ExtensionContext.Provider value={value}>{children}</ExtensionContext.Provider>;
}

export function useExtensions(): ExtensionContextValue {
  const value = useContext(ExtensionContext);
  if (!value) throw new Error("useExtensions must be used within ExtensionProvider");
  return value;
}
