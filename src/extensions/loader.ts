import { invoke } from "@tauri-apps/api/core";

import type { ExtensionManifest, ExtensionModule } from "./types";

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

export async function loadInstalledModules(): Promise<{
  manifests: ExtensionManifest[];
  getDaySubLabel: (date: Date) => string | undefined;
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
      modules.push(loaded);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return {
    manifests,
    getDaySubLabel: combineSubLabel(modules),
  };
}
