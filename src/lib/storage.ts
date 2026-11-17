import { invoke } from "@tauri-apps/api/core";

import { DEFAULT_APP_DATA, type AppData } from "./types";

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await invoke<string>("load_data");
    const parsed = JSON.parse(raw) as AppData;
    return {
      tasks: parsed.tasks ?? {},
      longTermTasks: Array.isArray(parsed.longTermTasks) ? parsed.longTermTasks : [],
      monthSummaries: parsed.monthSummaries ?? {},
      settings: {
        ...DEFAULT_APP_DATA.settings,
        ...parsed.settings,
        textColor: typeof parsed.settings?.textColor === "string" && /^#[0-9a-f]{6}$/i.test(parsed.settings.textColor)
          ? parsed.settings.textColor
          : null,
      },
    };
  } catch {
    return DEFAULT_APP_DATA;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await invoke("save_data", { json: JSON.stringify(data, null, 2) });
}
