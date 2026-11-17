export type Rgb = readonly [number, number, number];
export type BackdropSample = readonly [x: number, y: number, rgb: Rgb];
export const CONTRAST_MIDPOINT = 0.179;
const DOMINANT_BACKGROUND_SHARE = 0.75;

export const textEdgeColor = (color: string) => luminance(hexToRgb(color)) > CONTRAST_MIDPOINT ? "#000" : "#fff";

export function readableDefaultColor(background: Rgb) {
  return luminance(background) >= CONTRAST_MIDPOINT ? "#1c1a17" : "#faf8f2";
}

export function backdropForRegion(samples: readonly BackdropSample[], top: number, bottom: number): Rgb[] {
  return samples.filter(([, y]) => y >= top && y < bottom).map(([, , rgb]) => rgb);
}

export function classifyBackdropSides(samples: readonly BackdropSample[], top: number, bottom: number, card: Rgb, alpha: number) {
  const left = backdropForRegion(samples.filter(([x]) => x < 0.5), top, bottom);
  const right = backdropForRegion(samples.filter(([x]) => x >= 0.5), top, bottom);
  if (!left.length || !right.length) return null;
  const a = classifyBackdrop(left, card, alpha);
  const b = classifyBackdrop(right, card, alpha);
  const dark = (result: typeof a) => luminance(result.background) < CONTRAST_MIDPOINT;
  return !a.mixed && !b.mixed && dark(a) !== dark(b)
    ? { left: a.background, right: b.background }
    : null;
}

export function classifyBackdropRows(samples: readonly BackdropSample[], top: number, bottom: number, card: Rgb, alpha: number) {
  const rows = new Map<number, Rgb[]>();
  for (const [, y, rgb] of samples) {
    if (y < top || y >= bottom) continue;
    const row = rows.get(y);
    if (row) row.push(rgb);
    else rows.set(y, [rgb]);
  }

  const runs: { dark: boolean; first: number; last: number; colors: Rgb[] }[] = [];
  let current: (typeof runs)[number] | undefined;
  for (const [y, colors] of [...rows].sort(([a], [b]) => a - b)) {
    const row = classifyBackdrop(colors, card, alpha);
    if (row.mixed) { current = undefined; continue; }
    const dark = luminance(row.background) < CONTRAST_MIDPOINT;
    if (!current || current.dark !== dark) {
      current = { dark, first: y, last: y, colors: [] };
      runs.push(current);
    }
    current.last = y;
    current.colors.push(row.background);
  }

  // A single contrasting row (e.g. a window title bar) is not a stable split.
  const stable = runs.filter((run) => run.colors.length >= 2);
  if (!stable.some((run) => run.dark) || !stable.some((run) => !run.dark)) return [];
  let start = top;
  return stable.map((run, i) => {
    const next = stable[i + 1];
    const end = next ? (run.last + next.first) / 2 : bottom;
    const result = { top: start, bottom: end, background: classifyBackdrop(run.colors, card, 0).background };
    start = end;
    return result;
  });
}

export function hexToRgb(color: string): Rgb {
  const value = Number.parseInt(color.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
}

function rgbToHex(rgb: Rgb): string {
  return "#" + rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("");
}

export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function blendRgb(a: Rgb, b: Rgb, fraction: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * fraction,
    a[1] + (b[1] - a[1]) * fraction,
    a[2] + (b[2] - a[2]) * fraction,
  ];
}

export function classifyBackdrop(samples: readonly Rgb[], card: Rgb, alpha: number) {
  if (samples.length === 0 || alpha === 1) return { background: card, mixed: false };
  const pixels = samples.map((sample) => {
    const rgb = blendRgb(sample, card, alpha);
    return { rgb, light: luminance(rgb) };
  }).sort((a, b) => a.light - b.light);
  const split = pixels.findIndex((pixel) => pixel.light >= CONTRAST_MIDPOINT);
  const darkCount = split < 0 ? pixels.length : split;
  // The sample nearest the boundary is the hardest to read in the dominant group.
  if (darkCount / pixels.length >= DOMINANT_BACKGROUND_SHARE) {
    return { background: pixels[darkCount - 1].rgb, mixed: false };
  }
  if ((pixels.length - darkCount) / pixels.length >= DOMINANT_BACKGROUND_SHARE) {
    return { background: pixels[darkCount].rgb, mixed: false };
  }
  const background = pixels.reduce<Rgb>((average, pixel, i) => blendRgb(average, pixel.rgb, 1 / (i + 1)), card);
  return { background, mixed: true };
}

export function contrastingTextColor(preferred: string, background: Rgb): string {
  const bg = luminance(background);
  const contrast = (rgb: Rgb) => {
    const fg = luminance(rgb);
    return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
  };
  const original = hexToRgb(preferred);
  if (contrast(original) >= 4.5) return preferred;

  const near = (target: Rgb) => {
    if (contrast(target) < 4.5) return undefined;
    let low = 0, high = 255;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      const candidate = hexToRgb(rgbToHex(blendRgb(original, target, middle / 255)));
      if (contrast(candidate) >= 4.5) high = middle;
      else low = middle;
    }
    return { fraction: high, color: rgbToHex(blendRgb(original, target, high / 255)) };
  };
  const dark = near([0, 0, 0]);
  const light = near([255, 255, 255]);
  return dark && (!light || dark.fraction <= light.fraction)
    ? dark.color
    : light?.color ?? preferred;
}
