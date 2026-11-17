import type { ExtensionAPI, WidgetAppearance } from "../../src/extensions/types";
import { openSettingsMenu } from "../../src/lib/settingsMenu";

const FONTS = {
  default: "默认",
  sans: "雅黑",
  serif: "宋体",
  kai: "楷体",
  mono: "等宽",
} satisfies Record<WidgetAppearance["font"], string>;

const STYLES = {
  default: "默认",
  bold: "加粗",
  italic: "斜体",
  "bold-italic": "粗斜体",
} satisfies Record<WidgetAppearance["style"], string>;

type SavedAppearance = { [K in keyof WidgetAppearance]: WidgetAppearance[K] };
const SETTINGS_KEY = "appearance";
const DEFAULT_APPEARANCE: WidgetAppearance = { color: null, font: "default", style: "default" };

export function init(api: ExtensionAPI) {
  const saved = api.storage.get<SavedAppearance>(SETTINGS_KEY);
  const previousColor = saved === undefined ? api.ui.getLegacyTextColor() : null;
  let appearance: WidgetAppearance = saved ?? { ...DEFAULT_APPEARANCE, color: previousColor };
  if (previousColor) api.storage.set(SETTINGS_KEY, { ...appearance });

  const apply = () => api.ui.setAppearance(
    appearance.color === null && appearance.font === "default" && appearance.style === "default" && !appearance.autoContrast
      ? null
      : appearance,
  );
  apply();

  api.ui.registerPanel({
    id: "typography",
    title: "字体与颜色",
    slot: "settings",
    mount(container) {
      const rows = document.createElement("div");
      rows.style.display = "grid";
      rows.style.gridTemplateColumns = "max-content minmax(0, 1fr)";
      rows.style.alignItems = "center";
      rows.style.gap = "5px 8px";

      const labelFor = (labelText: string, field: HTMLElement) => {
        const label = document.createElement("label");
        label.textContent = labelText;
        label.htmlFor = field.id;
        return label;
      };

      let openChoice: (() => void) | undefined;
      const choice = <K extends "font" | "style">(
        name: K,
        label: string,
        options: Record<WidgetAppearance[K], string>,
      ) => {
        const wrapper = document.createElement("div");
        wrapper.className = "settings-choice";
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.id = `${api.extensionId}-${name}`;
        trigger.className = "settings-select-trigger";
        trigger.setAttribute("aria-label", label);
        trigger.setAttribute("aria-expanded", "false");
        const menu = document.createElement("div");
        menu.id = `${trigger.id}-options`;
        menu.className = "settings-choice-options settings-menu-surface";
        menu.setAttribute("popover", "manual");
        menu.setAttribute("data-contrast-surface", "");
        menu.setAttribute("role", "group");
        menu.setAttribute("aria-label", label + "选项");
        trigger.setAttribute("aria-controls", menu.id);
        let closeMenu: (() => void) | undefined;
        const close = () => {
          closeMenu?.();
          closeMenu = undefined;
          trigger.setAttribute("aria-expanded", "false");
          if (openChoice === close) openChoice = undefined;
        };
        const open = () => {
          openChoice?.();
          openChoice = close;
          trigger.setAttribute("aria-expanded", "true");
          closeMenu = openSettingsMenu(trigger, menu);
        };
        const buttons = new Map<WidgetAppearance[K], HTMLButtonElement>();
        for (const value of Object.keys(options) as WidgetAppearance[K][]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = options[value];
          button.addEventListener("click", () => {
            update({ [name]: value });
            close();
            trigger.focus();
          });
          buttons.set(value, button);
          menu.append(button);
        }
        trigger.addEventListener("click", () => closeMenu ? close() : open());
        wrapper.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const wasClosed = !closeMenu;
          if (wasClosed) open();
          const items = [...buttons.values()];
          const current = items.indexOf(event.target as HTMLButtonElement);
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const next = current < 0 ? (delta > 0 ? 0 : items.length - 1)
            : (current + delta + items.length) % items.length;
          (wasClosed ? buttons.get(appearance[name]) : items[next])?.focus();
        });
        wrapper.append(trigger, menu);
        return { trigger, wrapper, render: () => {
          trigger.textContent = options[appearance[name]];
          trigger.setAttribute("aria-label", `${label}：${options[appearance[name]]}`);
          for (const [value, button] of buttons) button.setAttribute("aria-pressed", String(value === appearance[name]));
        } };
      };

      const colorRow = document.createElement("div");
      colorRow.className = "settings-toggle-row";
      const color = document.createElement("input");
      color.type = "color";
      color.id = `${api.extensionId}-color`;
      color.style.cssText = "width:32px;height:24px;border:1px solid var(--border);border-radius:5px;padding:2px;background:transparent;cursor:pointer";
      const auto = document.createElement("button");
      auto.type = "button";
      auto.className = "settings-action-button";
      auto.textContent = "恢复自动";
      const automatic = document.createElement("span");
      automatic.className = "settings-hint";
      automatic.textContent = "自动";
      colorRow.append(color, auto, automatic);

      const font = choice("font", "字体", FONTS);
      const style = choice("style", "字形", STYLES);
      const typographyRow = document.createElement("div");
      typographyRow.style.cssText = "grid-column:1 / -1;display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px";
      for (const [label, control] of [["字体", font], ["字形", style]] as const) {
        const pair = document.createElement("div");
        pair.style.cssText = "display:flex;align-items:center;gap:6px;white-space:nowrap";
        pair.append(labelFor(label, control.trigger), control.wrapper);
        typographyRow.append(pair);
      }
      rows.append(labelFor("文字颜色", color), colorRow, typographyRow);

      const contrast = document.createElement("input");
      contrast.type = "checkbox";
      const contrastLabel = document.createElement("label");
      contrastLabel.className = "settings-toggle";
      contrastLabel.style.gridColumn = "1 / -1";
      contrastLabel.append(contrast, "自动增强对比度");
      const hint = document.createElement("p");
      hint.className = "settings-hint";
      hint.style.gridColumn = "1 / -1";
      hint.textContent = "根据背景和透明度调亮或调暗文字。";
      rows.append(contrastLabel, hint);

      const render = () => {
        color.value = appearance.color ?? "#1c1a17";
        auto.hidden = appearance.color === null;
        automatic.hidden = appearance.color !== null;
        font.render();
        style.render();
        contrast.checked = appearance.autoContrast ?? false;
      };
      const update = (next: Partial<WidgetAppearance>) => {
        appearance = { ...appearance, ...next };
        api.storage.set(SETTINGS_KEY, { ...appearance });
        apply();
        render();
      };

      color.addEventListener("input", () => update({ color: color.value }));
      auto.addEventListener("click", () => update({ color: null }));
      contrast.addEventListener("change", () => update({ autoContrast: contrast.checked }));
      const closeOutside = (event: PointerEvent) => {
        if (event.target instanceof Element && !event.target.closest(".settings-choice")) openChoice?.();
      };
      document.addEventListener("pointerdown", closeOutside);
      render();
      container.append(rows);
      return () => {
        openChoice?.();
        document.removeEventListener("pointerdown", closeOutside);
      };
    },
  });
}
