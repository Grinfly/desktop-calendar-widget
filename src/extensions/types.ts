import type { Task, LongTermTask } from "../lib/types";

export const EXTENSION_API_VERSION = 1;
export const EXTENSION_CAPABILITIES = ["tasks:read", "tasks:write", "ui:panels"] as const;
export type ExtensionCapability = (typeof EXTENSION_CAPABILITIES)[number];

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
  /** 缺省为旧版扩展；新扩展应显式声明 API 主版本。 */
  apiVersion?: number;
  capabilities?: ExtensionCapability[];
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Cleanup = () => void;

/** dateKey 为 null 时表示长期待办；任务 ID 与日期共同定位一条记录。 */
export interface ExtensionTask {
  dateKey: string | null;
  task: LongTermTask;
}

export type TaskPatch = Partial<Pick<Task, "title" | "done" | "note" | "color">>;
export type TaskCommand =
  | { type: "create"; dateKey: string | null; id: string; title: string }
  | { type: "update"; dateKey: string | null; id: string; patch: TaskPatch }
  | { type: "remove"; dateKey: string | null; id: string };

export interface TaskChange {
  type: "created" | "updated" | "removed";
  before?: ExtensionTask;
  after?: ExtensionTask;
}

export interface ExtensionEvents {
  "tasks:changed": { changes: TaskChange[] };
  "task:completed": ExtensionTask;
  "date:changed": { dateKey: string };
  "visibility:changed": { visible: boolean };
  "extension:message": { extensionId: string; topic: string; data: JsonValue };
}

export interface ExtensionPanel {
  id: string;
  title: string;
  slot: "dashboard" | "settings";
  /** 不依赖宿主 React 版本；卸载面板时调用返回的清理函数。 */
  mount(container: HTMLElement): void | Cleanup;
}

export interface ExtensionAPI {
  readonly apiVersion: typeof EXTENSION_API_VERSION;
  readonly extensionId: string;
  readonly signal: AbortSignal;
  storage: {
    get<T extends JsonValue = JsonValue>(key: string): T | undefined;
    set(key: string, value: JsonValue): void;
    remove(key: string): void;
  };
  tasks: {
    list(dateKey?: string | null): ExtensionTask[];
    create(dateKey: string | null, title: string): string;
    update(dateKey: string | null, id: string, patch: TaskPatch): void;
    remove(dateKey: string | null, id: string): void;
  };
  events: {
    on<K extends keyof ExtensionEvents>(name: K, handler: (event: ExtensionEvents[K]) => void): Cleanup;
    /** 发布带发送者 ID 的插件消息，不可伪造宿主任务事件。 */
    publish(topic: string, data: JsonValue): void;
  };
  timers: {
    setInterval(callback: () => void, milliseconds: number): Cleanup;
    setTimeout(callback: () => void, milliseconds: number): Cleanup;
  };
  ui: { registerPanel(panel: ExtensionPanel): Cleanup };
  onCleanup(cleanup: Cleanup): Cleanup;
  /** 日期信息或世界事件缓存改变后，请求宿主刷新。 */
  invalidate(): void;
}

export type DayBadge = "rest" | "work";

export const DAY_ATMOSPHERES = [
  "eveSnow",
  "springFu",
  "yuanxiaoSpark",
  "qingmingRain",
  "duanwuLeaf",
  "qixiStars",
  "midautumnMoon",
  "chongyangPetal",
  "yuandanConfetti",
  "guoqingRibbon",
] as const;

export type DayAtmosphere = (typeof DAY_ATMOSPHERES)[number];

export function asDayAtmosphere(value: unknown): DayAtmosphere | undefined {
  return (DAY_ATMOSPHERES as readonly string[]).includes(value as string)
    ? (value as DayAtmosphere)
    : undefined;
}

/** 物理世界事件类型（由 world-invasion 等扩展提供） */
export const WORLD_EVENT_TYPES = [
  "earthquake",
  "solarFlare",
  "rain",
  "heavyRain",
  "snow",
  "storm",
  "wind",
] as const;

export type WorldEventType = (typeof WORLD_EVENT_TYPES)[number];

export interface WorldEvent {
  /** 事件类型 */
  type: WorldEventType;
  /** 强度 0–1 */
  intensity: number;
  /** 显示标签，如 "M5.2 四川" */
  label: string;
  /** 事件过期时间（Unix ms），过期后主动清除 */
  expiresAt: number;
}

export interface ExtensionModule {
  /** 可选异步初始化：设置轮询、获取地理位置等 */
  init?(api: ExtensionAPI): void | Cleanup | Promise<void | Cleanup>;
  dispose?(): void;
  getDaySubLabel?(date: Date): string | undefined;
  getDayBadge?(date: Date): DayBadge | undefined;
  getDayAtmosphere?(date: Date): DayAtmosphere | undefined;
  /** 返回当前物理世界事件（同步，内部缓存） */
  getWorldEvent?(): WorldEvent | undefined;
}
