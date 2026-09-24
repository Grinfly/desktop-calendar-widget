import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { PinMode } from "./types";

interface WallpaperTheme {
  bgRgb: string;
  accent: string;
  muted: string;
  subLabel: string;
  border: string;
}

const THEME_VARS = ["--bg-rgb", "--accent", "--muted", "--sub-label", "--border"] as const;
const TEXT_THEME_VARS = ["--accent", "--muted", "--sub-label", "--border"] as const;

export function applyBackgroundOpacityCss(opacity: number) {
  const alpha = Math.min(100, Math.max(0, opacity)) / 100;
  document.documentElement.style.setProperty("--bg-alpha", String(alpha));
}

export function clearWallpaperTheme() {
  const root = document.documentElement.style;
  for (const name of THEME_VARS) {
    root.removeProperty(name);
  }
}

export function applyWallpaperThemeCss(theme: WallpaperTheme, includeText: boolean) {
  const root = document.documentElement.style;
  root.setProperty("--bg-rgb", theme.bgRgb);
  if (includeText) {
    root.setProperty("--accent", theme.accent);
    root.setProperty("--muted", theme.muted);
    root.setProperty("--sub-label", theme.subLabel);
    root.setProperty("--border", theme.border);
    return;
  }
  for (const name of TEXT_THEME_VARS) {
    root.removeProperty(name);
  }
}

export async function wallpaperSourceRevision(): Promise<number> {
  try {
    return await invoke<number>("wallpaper_source_revision");
  } catch {
    return 0;
  }
}

export async function applyWallpaperTheme(includeText = false) {
  try {
    const theme = await invoke<WallpaperTheme | null>("sample_wallpaper_theme");
    if (!theme) {
      clearWallpaperTheme();
      return;
    }
    applyWallpaperThemeCss(theme, includeText);
  } catch (error) {
    console.error("读取壁纸配色失败", error);
    clearWallpaperTheme();
  }
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
