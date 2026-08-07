import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { PinMode } from "./types";

export function applyBackgroundOpacityCss(opacity: number) {
  const alpha = Math.min(100, Math.max(0, opacity)) / 100;
  document.documentElement.style.setProperty("--bg-alpha", String(alpha));
}

export async function applyBackgroundOpacity(opacity: number) {
  applyBackgroundOpacityCss(opacity);

  try {
    const window = getCurrentWindow();
    // On Windows 8+, a non-zero alpha is ignored and paints an opaque
    // rectangle — that shows as sharp tips outside CSS border-radius.
    // Keep the clear color fully transparent; card opacity is CSS-only.
    await window.setBackgroundColor({
      red: 0,
      green: 0,
      blue: 0,
      alpha: 0,
    });
  } catch (error) {
    console.error("同步窗口背景透明度失败", error);
  }
}

export async function setPinMode(mode: PinMode): Promise<void> {
  await invoke("set_pin_mode", { mode });
}
