import {
  backdropForRegion, classifyBackdrop, classifyBackdropRows, classifyBackdropSides, textEdgeColor,
  type BackdropSample, type Rgb,
} from "./textContrast";

interface SpatialContrast {
  samples: readonly BackdropSample[];
  textColor: (background: Rgb) => string;
  card: Rgb;
  alpha: number;
  headerEnd: number;
  footerStart: number;
}

const PROPERTIES = ["--spatial-color", "--spatial-edge", "--spatial-shadow", "--spatial-icon-filter"] as const;
const CONTROLS = "button, input, select, textarea, .settings-select-wrap";
const SOLID_CONTROLS = "[data-contrast-surface], .task-add-button, .confirm-btn.danger, .picker-month-cell.active, .day-badge-label";

function textBounds(element: HTMLElement, range: Range) {
  const text = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  if (!text.length) return element.matches(CONTROLS) ? element.getBoundingClientRect() : null;
  range.setStartBefore(text[0]);
  range.setEndAfter(text[text.length - 1]);
  return range.getBoundingClientRect();
}

export function applySpatialContrast(contrast?: SpatialContrast) {
  const widget = document.querySelector(".widget-card");
  if (!widget) return;
  const previous = new Set(widget.querySelectorAll<HTMLElement>("[data-spatial-contrast]"));

  if (contrast && contrast.alpha < 1 && contrast.samples.length > 0) {
    const { textColor, samples, card, alpha, headerEnd, footerStart } = contrast;
    const leftSamples = samples.filter(([x]) => x < 0.5);
    const rightSamples = samples.filter(([x]) => x >= 0.5);
    const bands = [[0, headerEnd], [headerEnd, footerStart], [footerStart, 1]].map(([top, bottom]) => {
      const sides = classifyBackdropSides(samples, top, bottom, card, alpha);
      const leftRows = classifyBackdropRows(leftSamples, top, bottom, card, alpha);
      const rightRows = classifyBackdropRows(rightSamples, top, bottom, card, alpha);
      if (!sides && !leftRows.length && !rightRows.length) return { top, bottom, palette: null };

      const column = (rows: typeof leftRows, samplesForSide: readonly BackdropSample[], sideBackground?: Rgb) => {
        const local = backdropForRegion(samplesForSide, top, bottom);
        const fallback = sideBackground ?? classifyBackdrop(
          local.length > 0 ? local : backdropForRegion(samples, top, bottom), card, alpha,
        ).background;
        return (rows.length ? rows : [{ top, bottom, background: fallback }]).map((row) => ({
          ...row, color: textColor(row.background),
        }));
      };
      return { top, bottom, palette: {
        left: column(leftRows, leftSamples, sides?.left),
        right: column(rightRows, rightSamples, sides?.right),
      } };
    });
    if (bands.some((band) => band.palette)) {
      const rect = widget.getBoundingClientRect();
      const divider = rect.left + rect.width / 2;
      const range = document.createRange();
      const planned: { element: HTMLElement; color: string; crossing: boolean }[] = [];
      for (const element of widget.querySelectorAll<HTMLElement>(
        `${CONTROLS}, label, span, p, small, strong, div, li, h2, h3`,
      )) {
        if (element.closest(SOLID_CONTROLS)) continue;
        const bounds = textBounds(element, range);
        if (!bounds || bounds.width === 0 || bounds.height === 0) continue;
        const y = (bounds.top + bounds.height / 2 - rect.top) / rect.height;
        const palette = bands.find((band) => y >= band.top && y < band.bottom)?.palette;
        if (!palette) continue;
        const left = palette.left.find((row) => y >= row.top && y < row.bottom);
        const right = palette.right.find((row) => y >= row.top && y < row.bottom);
        const onLeft = bounds.left + bounds.width / 2 < divider;
        const row = onLeft ? left : right;
        if (!row) continue;
        const crossesSide = left?.color !== right?.color && bounds.left < divider && bounds.right > divider;
        const top = (bounds.top - rect.top) / rect.height;
        const bottom = (bounds.bottom - rect.top) / rect.height;
        const crossesRow = (onLeft ? palette.left : palette.right).some((neighbor) =>
          neighbor.color !== row.color && neighbor.top < bottom && neighbor.bottom > top,
        );
        planned.push({ element, color: row.color, crossing: crossesSide || crossesRow });
      }
      for (const { element, color, crossing } of planned) {
        const edge = textEdgeColor(color);
        element.setAttribute("data-spatial-contrast", "");
        element.style.setProperty("--spatial-color", color);
        element.style.setProperty("--spatial-edge", edge);
        element.style.setProperty("--spatial-shadow", crossing ? `0 0 1px ${edge}` : "none");
        element.style.setProperty("--spatial-icon-filter", crossing ? `drop-shadow(0 0 1px ${edge})` : "none");
        previous.delete(element);
      }
    }
  }

  for (const element of previous) {
    element.removeAttribute("data-spatial-contrast");
    for (const property of PROPERTIES) element.style.removeProperty(property);
  }
}
