import { getCurrentWindow } from "@tauri-apps/api/window";

export function applyBackgroundOpacityCss(opacity: number) {
  const alpha = Math.min(100, Math.max(0, opacity)) / 100;
  document.documentElement.style.setProperty("--bg-alpha", String(alpha));
}

export async function applyBackgroundOpacity(opacity: number) {
  applyBackgroundOpacityCss(opacity);

  try {
    const window = getCurrentWindow();
    const clamped = Math.min(100, Math.max(20, opacity));
    const alpha = Math.round((clamped / 100) * 255);
    await window.setBackgroundColor({
      red: 247,
      green: 243,
      blue: 236,
      alpha,
    });
  } catch (error) {
    console.error("同步窗口背景透明度失败", error);
  }
}

export async function setPinMode(mode: "floating" | "desktop"): Promise<void> {
  const window = getCurrentWindow();
  const floating = mode === "floating";
  const current = await window.isAlwaysOnTop();

  if (current === floating) {
    return;
  }

  await window.setAlwaysOnTop(floating);
}
