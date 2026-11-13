import { invoke } from "@tauri-apps/api/core";
import { toDateKey } from "../lib/dates";
import type { DayBadge, ExtensionManifest, ExtensionModule } from "./types";

export function listExtensions(): Promise<ExtensionManifest[]> {
  return invoke("list_extensions");
}

export function installExtension(): Promise<ExtensionManifest | null> {
  return invoke("install_extension");
}

export function uninstallExtension(id: string): Promise<void> {
  return invoke("uninstall_extension", { id });
}

export function withHostBadges(
  hostDays: Record<string, string>,
  fallback: (date: Date) => DayBadge | undefined,
): (date: Date) => DayBadge | undefined {
  return (date: Date) => {
    const value = hostDays[toDateKey(date)];
    return value === "rest" || value === "work" ? value : fallback(date);
  };
}

export function loadWorkRestDays(): Promise<Record<string, string>> {
  return invoke("load_work_rest_days", { today: toDateKey(new Date()) });
}

export async function importExtensionModule(manifest: ExtensionManifest): Promise<ExtensionModule> {
  const source = await invoke<string>("read_extension_entry", { id: manifest.id });
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    return await import(/* @vite-ignore */ url) as ExtensionModule;
  } finally {
    URL.revokeObjectURL(url);
  }
}
