import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { WidgetAppearance } from "../extensions/types";
import {
  backdropForRegion, classifyBackdrop, contrastingTextColor, readableDefaultColor, textEdgeColor,
  type BackdropSample, type Rgb,
} from "./textContrast";
import { applySpatialContrast } from "./spatialContrast";
import type { PinMode } from "./types";

export interface WallpaperTheme {
  bgRgb: string;
  wallpaperRgb: Rgb;
  accent: string;
  muted: string;
  subLabel: string;
  border: string;
}

const TEXT_THEME_VARS = ["--accent", "--wallpaper-muted", "--wallpaper-sub-label", "--border"] as const;

export function applyBackgroundOpacityCss(opacity: number) {
  const alpha = Math.min(100, Math.max(0, opacity)) / 100;
  const root = document.documentElement;
  root.style.setProperty("--bg-alpha", String(alpha));
  root.toggleAttribute("data-low-opacity", alpha <= 0.5);
}

function applyTextColor(color: string | null) {
  const root = document.documentElement;
  root.toggleAttribute("data-custom-text", color !== null);
  if (color === null) {
    root.style.removeProperty("--custom-text");
    root.style.removeProperty("--text-edge");
    return;
  }

  root.style.setProperty("--custom-text", color);
  root.style.setProperty("--text-edge", textEdgeColor(color));
}

export function readWidgetContrastLayout() {
  const widget = document.querySelector(".widget-card");
  const card = widget?.getBoundingClientRect();
  if (!widget || !card || card.height === 0) return { paint: "", headerEnd: 0, footerStart: 1 };
  const fraction = (y: number) => Math.max(0, Math.min(1, (y - card.top) / card.height));
  const header = widget.querySelector(".title-bar")?.getBoundingClientRect();
  const footers = Array.from(widget.querySelectorAll(".task-footer, .extension-slot-dashboard"));
  return {
    paint: getComputedStyle(widget).backgroundColor,
    headerEnd: fraction(header?.bottom ?? card.top),
    footerStart: Math.min(1, ...footers.map((footer) => fraction(footer.getBoundingClientRect().top))),
  };
}

const FONT_STACKS = {
  default: "",
  sans: '"Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif',
  serif: '"SimSun", "Noto Serif SC", serif',
  kai: '"KaiTi", "STKaiti", "Noto Serif SC", serif',
  mono: '"Cascadia Mono", "Consolas", "Microsoft YaHei", monospace',
} satisfies Record<WidgetAppearance["font"], string>;

export function applyWidgetAppearance(
  appearance: Readonly<WidgetAppearance> | undefined,
  opacity = 100,
  wallpaper: WallpaperTheme | null = null,
  backdrop: readonly BackdropSample[] | null = null,
  defaultContrast = false,
) {
  let color = appearance?.color ?? null;
  const root = document.documentElement;
  const autoContrast = defaultContrast || appearance?.autoContrast === true;
  let mixed = false;
  let spatial: Parameters<typeof applySpatialContrast>[0];
  if (autoContrast) {
    const { paint, headerEnd, footerStart } = readWidgetContrastLayout();
    const painted = paint.match(/[\d.]+/g)?.map(Number);
    const [r, g, b, a] = painted ?? [247, 243, 236, opacity / 100];
    const card: Rgb = [r, g, b];
    const preferred = color ?? "#1c1a17";
    const textColor = defaultContrast
      ? readableDefaultColor
      : (background: Rgb) => contrastingTextColor(preferred, background);
    const fallback = backdrop?.map(([, , rgb]) => rgb) ?? (wallpaper ? [wallpaper.wallpaperRgb] : []);
    if (backdrop) spatial = { samples: backdrop, textColor, card, alpha: a ?? 1, headerEnd, footerStart };
    const palette = (top: number, bottom: number) => {
      const samples = backdropForRegion(backdrop ?? [], top, bottom);
      const result = classifyBackdrop(samples.length > 0 ? samples : fallback, card, a ?? 1);
      return { color: textColor(result.background), mixed: result.mixed };
    };
    const content = palette(headerEnd, footerStart);
    color = content.color;
    mixed = content.mixed;
    for (const [region, result] of [
      ["header", palette(0, headerEnd)],
      ["footer", palette(footerStart, 1)],
    ] as const) {
      const edge = textEdgeColor(result.color);
      root.style.setProperty(`--${region}-contrast-color`, result.color);
      root.style.setProperty(`--${region}-contrast-edge`, edge);
      root.style.setProperty(`--${region}-contrast-shadow`, result.mixed ? `0 0 1px ${edge}` : "none");
      if (region === "header") {
        root.style.setProperty("--header-contrast-icon-filter", result.mixed ? `drop-shadow(0 0 1px ${edge})` : "none");
      }
    }
  }
  root.toggleAttribute("data-auto-contrast", autoContrast);
  root.toggleAttribute("data-mixed-backdrop", mixed);
  applyTextColor(color);
  const style = root.style;
  const font = FONT_STACKS[appearance?.font ?? "default"];
  if (font) style.setProperty("--custom-font", font);
  else style.removeProperty("--custom-font");
  if (appearance?.style.includes("bold")) style.setProperty("--custom-weight", "700");
  else style.removeProperty("--custom-weight");
  if (appearance?.style.includes("italic")) style.setProperty("--custom-font-style", "italic");
  else style.removeProperty("--custom-font-style");
  applySpatialContrast(spatial);
}

export function applyWallpaperThemeCss(theme: WallpaperTheme | null, includeText: boolean) {
  const root = document.documentElement.style;
  if (theme) root.setProperty("--bg-rgb", theme.bgRgb);
  else root.removeProperty("--bg-rgb");
  if (theme && includeText) {
    root.setProperty("--accent", theme.accent);
    root.setProperty("--wallpaper-muted", theme.muted);
    root.setProperty("--wallpaper-sub-label", theme.subLabel);
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

export async function sampleWallpaperTheme(): Promise<WallpaperTheme | null> {
  try {
    return await invoke<WallpaperTheme | null>("sample_wallpaper_theme");
  } catch {
    return null;
  }
}

export async function sampleDesktopBackdrop(): Promise<readonly BackdropSample[] | null> {
  try {
    return await invoke<readonly BackdropSample[] | null>("sample_desktop_backdrop");
  } catch {
    return null;
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
