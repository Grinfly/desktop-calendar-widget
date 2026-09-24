export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
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
  init?(): Promise<void>;
  getDaySubLabel?(date: Date): string | undefined;
  getDayBadge?(date: Date): DayBadge | undefined;
  getDayAtmosphere?(date: Date): DayAtmosphere | undefined;
  /** 返回当前物理世界事件（同步，内部缓存） */
  getWorldEvent?(): WorldEvent | undefined;
}
