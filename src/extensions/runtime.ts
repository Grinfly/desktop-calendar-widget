import { normalizeTaskPatch, validateDateKey } from "./taskApi";
import {
  EXTENSION_API_VERSION, EXTENSION_CAPABILITIES, WORLD_EVENT_TYPES, asDayAtmosphere,
  type Cleanup, type ExtensionAPI, type ExtensionEvents, type ExtensionManifest,
  type ExtensionModule, type ExtensionPanel, type ExtensionTask, type JsonValue,
  type TaskCommand, type WorldEvent,
} from "./types";

export interface ExtensionHost {
  listTasks(dateKey?: string | null): ExtensionTask[];
  writeTask(command: TaskCommand): void;
}

export interface ExtensionState {
  manifest: ExtensionManifest;
  status: "loading" | "active" | "disabled" | "error" | "incompatible";
  error?: string;
}

export interface RegisteredPanel extends ExtensionPanel {
  extensionId: string;
}

interface Entry extends ExtensionState {
  controller: AbortController;
  cleanups: Set<Cleanup>;
  module?: ExtensionModule;
  panels: RegisteredPanel[];
}

type Listener = { entry: Entry; handler: (event: never) => void };
type StorageBackend = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const DISABLED_KEY = "cando:extensions:disabled";
const LOAD_TIMEOUT_MS = 10_000;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonCopy<T>(value: T): T {
  const text = JSON.stringify(value, (_key, item: unknown) => {
    if (item === undefined || typeof item === "function" || typeof item === "symbol"
      || (typeof item === "number" && !Number.isFinite(item))) throw new Error("数据必须是有效 JSON");
    return item;
  });
  return JSON.parse(text) as T;
}

export function compatibilityError(manifest: ExtensionManifest): string | undefined {
  if (manifest.apiVersion !== undefined && manifest.apiVersion !== EXTENSION_API_VERSION) {
    return `此扩展需要 API ${manifest.apiVersion}，当前支持 API ${EXTENSION_API_VERSION}`;
  }
  if (manifest.capabilities !== undefined && (!Array.isArray(manifest.capabilities)
    || manifest.capabilities.some((name) => !(EXTENSION_CAPABILITIES as readonly string[]).includes(name)))) {
    return "此扩展要求当前主程序尚未提供的能力";
  }
  return undefined;
}

/** 同页面可信扩展运行时；能力声明是 API 契约，不是安全沙箱。 */
export class ExtensionRuntime {
  private entries = new Map<string, Entry>();
  private listeners = new Map<keyof ExtensionEvents, Set<Listener>>();
  private disabled: Set<string>;
  private stopped = false;
  private notificationPending = false;
  private worldEvent: WorldEvent | undefined;

  constructor(
    private host: ExtensionHost,
    private storage: StorageBackend,
    private importModule: (manifest: ExtensionManifest) => Promise<ExtensionModule>,
    private changed: () => void,
  ) {
    let saved: unknown;
    try { saved = JSON.parse(storage.getItem(DISABLED_KEY) ?? "[]"); } catch { saved = []; }
    this.disabled = new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
  }

  private notify = () => {
    if (this.stopped || this.notificationPending) return;
    this.notificationPending = true;
    queueMicrotask(() => {
      this.notificationPending = false;
      if (!this.stopped) this.changed();
    });
  };

  get states(): ExtensionState[] {
    return [...this.entries.values()].map(({ manifest, status, error }) => ({ manifest, status, error }));
  }

  get panels(): RegisteredPanel[] {
    return [...this.entries.values()].filter((entry) => entry.status === "active").flatMap((entry) => entry.panels);
  }

  get hasDayBadges(): boolean {
    return [...this.entries.values()].some((entry) => entry.status === "active" && typeof entry.module?.getDayBadge === "function");
  }

  private alive(entry: Entry) {
    return !this.stopped && !entry.controller.signal.aborted;
  }

  private track(entry: Entry, cleanup: Cleanup): Cleanup {
    let done = false;
    const dispose = () => {
      if (done) return;
      done = true;
      entry.cleanups.delete(dispose);
      try { cleanup(); } catch (error) { console.warn(`[${entry.manifest.id}] 清理失败`, error); }
    };
    if (this.alive(entry)) entry.cleanups.add(dispose);
    else dispose();
    return dispose;
  }

  private stopEntry(entry: Entry) {
    if (entry.controller.signal.aborted) return;
    entry.controller.abort();
    for (const cleanup of [...entry.cleanups].reverse()) cleanup();
    entry.panels = [];
    try { entry.module?.dispose?.(); } catch (error) { console.warn(`[${entry.manifest.id}] 停用失败`, error); }
  }

  private fail(entry: Entry, error: unknown) {
    if (!this.alive(entry)) return;
    entry.status = "error";
    entry.error = errorText(error);
    this.stopEntry(entry);
    this.notify();
  }

  private call(entry: Entry, callback: () => unknown): void {
    if (!this.alive(entry)) return;
    try {
      const result = callback();
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        void Promise.resolve(result).catch((error) => this.fail(entry, error));
      }
    } catch (error) { this.fail(entry, error); }
  }

  private api(entry: Entry): ExtensionAPI {
    const assertActive = () => {
      if (!this.alive(entry)) throw new Error("扩展已停用");
    };
    const requireCapability = (name: string) => {
      assertActive();
      if (!(entry.manifest.capabilities as readonly string[] | undefined)?.includes(name)) {
        throw new Error(`扩展未声明能力：${name}`);
      }
    };
    const storageKey = `cando:extension-data:${entry.manifest.id}`;
    const readStorage = (): Record<string, JsonValue> => {
      assertActive();
      const value: unknown = JSON.parse(this.storage.getItem(storageKey) ?? "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("扩展存储格式无效");
      return value as Record<string, JsonValue>;
    };
    const write = (command: TaskCommand) => {
      requireCapability("tasks:write");
      validateDateKey(command.dateKey);
      if (typeof command.id !== "string" || !command.id) throw new Error("任务 ID 无效");
      this.host.writeTask(command);
    };
    const timer = (callback: () => void, milliseconds: number, repeat: boolean): Cleanup => {
      assertActive();
      if (!Number.isFinite(milliseconds) || milliseconds < (repeat ? 100 : 0) || milliseconds > 2_147_483_647) {
        throw new Error("计时间隔无效（重复计时至少 100 毫秒）");
      }
      const run = () => { if (!repeat) cancel(); this.call(entry, callback); };
      const id = repeat ? setInterval(run, milliseconds) : setTimeout(run, milliseconds);
      const cancel = this.track(entry, () => { clearTimeout(id); clearInterval(id); });
      return cancel;
    };
    return {
      apiVersion: EXTENSION_API_VERSION,
      extensionId: entry.manifest.id,
      signal: entry.controller.signal,
      storage: {
        get: <T extends JsonValue>(key: string) => {
          const data = readStorage();
          return Object.prototype.hasOwnProperty.call(data, key) ? data[key] as T : undefined;
        },
        set: (key, value) => {
          const data = { ...readStorage(), [key]: jsonCopy(value) };
          this.storage.setItem(storageKey, JSON.stringify(data));
        },
        remove: (key) => {
          const data = readStorage();
          delete data[key];
          this.storage.setItem(storageKey, JSON.stringify(data));
        },
      },
      tasks: {
        list: (dateKey) => {
          requireCapability("tasks:read");
          if (dateKey !== undefined) validateDateKey(dateKey);
          return structuredClone(this.host.listTasks(dateKey));
        },
        create: (dateKey, title) => {
          const patch = normalizeTaskPatch({ title });
          const id = crypto.randomUUID();
          write({ type: "create", dateKey, id, title: patch.title! });
          return id;
        },
        update: (dateKey, id, patch) => write({ type: "update", dateKey, id, patch: normalizeTaskPatch(patch) }),
        remove: (dateKey, id) => write({ type: "remove", dateKey, id }),
      },
      events: {
        on: (name, handler) => {
          assertActive();
          if (name === "tasks:changed" || name === "task:completed") requireCapability("tasks:read");
          let listeners = this.listeners.get(name);
          if (!listeners) this.listeners.set(name, listeners = new Set());
          const listener: Listener = { entry, handler: handler as (event: never) => void };
          listeners.add(listener);
          return this.track(entry, () => listeners.delete(listener));
        },
        publish: (topic, data) => {
          assertActive();
          if (typeof topic !== "string" || !topic.trim() || topic.length > 128) throw new Error("消息主题无效");
          // 异步派发，避免插件在自己的订阅中发布消息时递归耗尽调用栈。
          const message = { extensionId: entry.manifest.id, topic, data: jsonCopy(data) };
          timer(() => this.emit("extension:message", message), 0, false);
        },
      },
      timers: {
        setInterval: (callback, ms) => timer(callback, ms, true),
        setTimeout: (callback, ms) => timer(callback, ms, false),
      },
      ui: {
        registerPanel: (panel) => {
          requireCapability("ui:panels");
          if (!/^[a-z0-9-]+$/.test(panel.id) || !panel.title?.trim() || typeof panel.mount !== "function"
            || !["dashboard", "settings"].includes(panel.slot)) throw new Error("扩展面板定义无效");
          if (entry.panels.some((item) => item.id === panel.id)) throw new Error(`面板 ID 重复：${panel.id}`);
          const registered: RegisteredPanel = { ...panel, extensionId: entry.manifest.id };
          entry.panels.push(registered);
          this.notify();
          return this.track(entry, () => {
            entry.panels = entry.panels.filter((item) => item !== registered);
            this.notify();
          });
        },
      },
      onCleanup: (cleanup) => this.track(entry, cleanup),
      invalidate: () => { assertActive(); this.notify(); },
    };
  }

  async start(manifests: ExtensionManifest[]): Promise<void> {
    await Promise.allSettled(manifests.map((manifest) => this.activate(manifest)));
  }

  private async activate(manifest: ExtensionManifest): Promise<void> {
    if (this.stopped) return;
    const entry: Entry = { manifest, status: "loading", controller: new AbortController(), cleanups: new Set(), panels: [] };
    this.entries.set(manifest.id, entry);
    const incompatible = compatibilityError(manifest);
    if (incompatible) { entry.status = "incompatible"; entry.error = incompatible; this.notify(); return; }
    if (this.disabled.has(manifest.id)) { entry.status = "disabled"; this.notify(); return; }
    this.notify();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const initialize = async () => {
        const module = await this.importModule(manifest);
        if (!this.alive(entry)) return;
        entry.module = module;
        const cleanup = await module.init?.(this.api(entry));
        if (typeof cleanup === "function") this.track(entry, cleanup);
      };
      await Promise.race([
        initialize(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("扩展初始化超时")), LOAD_TIMEOUT_MS);
          // 停用或 React 卸载时立即结束等待；晚到的初始化清理由 track 负责。
          entry.controller.signal.addEventListener("abort", () => reject(new Error("扩展已停用")), { once: true });
        }),
      ]);
      if (this.alive(entry)) entry.status = "active";
    } catch (error) { this.fail(entry, error); }
    finally { clearTimeout(timeout); this.notify(); }
  }

  async setEnabled(id: string, enabled: boolean, activate = true): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry || this.stopped) return;
    const next = new Set(this.disabled);
    if (enabled) next.delete(id); else next.add(id);
    this.storage.setItem(DISABLED_KEY, JSON.stringify([...next]));
    this.disabled = next;
    this.stopEntry(entry);
    entry.status = "disabled";
    entry.error = undefined;
    this.notify();
    if (enabled && activate) await this.activate(entry.manifest);
  }

  emit<K extends keyof ExtensionEvents>(name: K, event: ExtensionEvents[K]): void {
    for (const listener of [...this.listeners.get(name) ?? []]) {
      this.call(listener.entry, () => listener.handler(structuredClone(event) as never));
    }
  }

  mountPanel(panel: RegisteredPanel, container: HTMLElement): Cleanup {
    const entry = this.entries.get(panel.extensionId);
    if (!entry || entry.status !== "active") return () => {};
    let cleanup: void | Cleanup;
    this.call(entry, () => { cleanup = panel.mount(container); });
    return this.track(entry, () => { try { cleanup?.(); } finally { container.replaceChildren(); } });
  }

  private first<T>(callback: (module: ExtensionModule) => T | undefined): T | undefined {
    for (const entry of this.entries.values()) {
      if (entry.status !== "active" || !entry.module) continue;
      try {
        const result = callback(entry.module);
        if (result !== undefined) return result;
      } catch (error) { this.fail(entry, error); }
    }
    return undefined;
  }

  getDaySubLabel = (date: Date) => this.first((mod) => {
    const value = mod.getDaySubLabel?.(new Date(date));
    return typeof value === "string" && value ? value : undefined;
  });

  getDayBadge = (date: Date) => this.first((mod) => {
    const value = mod.getDayBadge?.(new Date(date));
    return value === "work" || value === "rest" ? value : undefined;
  });

  getDayAtmosphere = (date: Date) => this.first((mod) => asDayAtmosphere(mod.getDayAtmosphere?.(new Date(date))));

  getWorldEvent = (): WorldEvent | undefined => {
    let best: WorldEvent | undefined;
    this.first((mod) => {
      const event = mod.getWorldEvent?.();
      if (event && WORLD_EVENT_TYPES.includes(event.type) && Number.isFinite(event.intensity)
        && Number.isFinite(event.expiresAt) && event.expiresAt > Date.now() && typeof event.label === "string"
        && (!best || event.intensity > best.intensity)) {
        best = { ...event, intensity: Math.max(0, Math.min(1, event.intensity)) };
      }
      return undefined;
    });
    const previous = this.worldEvent;
    if (best?.type === previous?.type && best?.intensity === previous?.intensity
      && best?.label === previous?.label && best?.expiresAt === previous?.expiresAt) return previous;
    this.worldEvent = best;
    return best;
  };

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const entry of this.entries.values()) this.stopEntry(entry);
    this.listeners.clear();
  }
}
