import { invoke } from "@tauri-apps/api/core";

import { toDateKey } from "../lib/dates";
import {
  asDayAtmosphere,
  type DayAtmosphere,
  type DayBadge,
  type ExtensionManifest,
  type ExtensionModule,
  type WorldEvent,
} from "./types";

export function listExtensions(): Promise<ExtensionManifest[]> {
  return invoke("list_extensions");
}

export function installExtension(): Promise<ExtensionManifest | null> {
  return invoke("install_extension");
}

export function uninstallExtension(id: string): Promise<void> {
  return invoke("uninstall_extension", { id });
}

function combineSubLabel(
  modules: ExtensionModule[],
): (date: Date) => string | undefined {
  return (date: Date) => {
    for (const mod of modules) {
      const label = mod.getDaySubLabel?.(date);
      if (label) return label;
    }
    return undefined;
  };
}

function combineBadge(
  modules: ExtensionModule[],
): (date: Date) => DayBadge | undefined {
  return (date: Date) => {
    for (const mod of modules) {
      const badge = mod.getDayBadge?.(date);
      if (badge) return badge;
    }
    return undefined;
  };
}

function combineAtmosphere(
  modules: ExtensionModule[],
): (date: Date) => DayAtmosphere | undefined {
  return (date: Date) => {
    for (const mod of modules) {
      const kind = asDayAtmosphere(mod.getDayAtmosphere?.(date));
      if (kind) return kind;
    }
    return undefined;
  };
}

/** 合并多个扩展的 getWorldEvent：取强度最高、未过期的事件 */
function combineWorldEvent(
  modules: ExtensionModule[],
): () => WorldEvent | undefined {
  return () => {
    const now = Date.now();
    let best: WorldEvent | undefined;
    for (const mod of modules) {
      const event = mod.getWorldEvent?.();
      if (!event) continue;
      if (event.expiresAt < now) continue;
      if (!best || event.intensity > best.intensity) best = event;
    }
    return best;
  };
}

function asBadge(value: string | undefined): DayBadge | undefined {
  if (value === "rest" || value === "work") return value;
  return undefined;
}

export function withHostBadges(
  hostDays: Record<string, string>,
  fallback: (date: Date) => DayBadge | undefined,
): (date: Date) => DayBadge | undefined {
  return (date: Date) => asBadge(hostDays[toDateKey(date)]) ?? fallback(date);
}

export function loadWorkRestDays(): Promise<Record<string, string>> {
  return invoke("load_work_rest_days", { today: toDateKey(new Date()) });
}

export async function loadInstalledModules(): Promise<{
  manifests: ExtensionManifest[];
  getDaySubLabel: (date: Date) => string | undefined;
  getDayBadge: (date: Date) => DayBadge | undefined;
  getDayAtmosphere: (date: Date) => DayAtmosphere | undefined;
  getWorldEvent: () => WorldEvent | undefined;
}> {
  const manifests = await listExtensions();
  const modules: ExtensionModule[] = [];

  for (const manifest of manifests) {
    const source = await invoke<string>("read_extension_entry", {
      id: manifest.id,
    });
    const blob = new Blob([source], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    try {
      const loaded = (await import(/* @vite-ignore */ url)) as ExtensionModule;
      // 调用可选的异步初始化钩子（如设置 API 轮询）
      if (typeof loaded.init === "function") {
        await loaded.init();
      }
      modules.push(loaded);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return {
    manifests,
    getDaySubLabel: combineSubLabel(modules),
    getDayBadge: combineBadge(modules),
    getDayAtmosphere: combineAtmosphere(modules),
    getWorldEvent: combineWorldEvent(modules),
  };
}

