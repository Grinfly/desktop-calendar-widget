export function openSettingsMenu(trigger: HTMLElement, menu: HTMLElement) {
  const panel = trigger.closest(".settings-panel");
  if (!panel) return () => {};
  const gap = 5;
  const inset = 4;
  menu.showPopover();

  const place = () => {
    const anchor = trigger.getBoundingClientRect();
    const bounds = panel.getBoundingClientRect();
    const style = getComputedStyle(trigger);
    const dark = style.getPropertyValue("--text-edge").trim() === "#000";
    menu.toggleAttribute("data-dark-frost", dark);
    menu.style.setProperty("--settings-menu-bg", style.backgroundColor);
    menu.style.maxWidth = `${Math.max(0, bounds.width - inset * 2)}px`;

    const desiredHeight = menu.scrollHeight + menu.offsetHeight - menu.clientHeight;
    const below = bounds.bottom - inset - anchor.bottom - gap;
    const above = anchor.top - bounds.top - inset - gap;
    const useAbove = desiredHeight > below && above > below;
    menu.style.maxHeight = `${Math.max(0, useAbove ? above : below)}px`;
    const top = useAbove ? anchor.top - gap - menu.offsetHeight : anchor.bottom + gap;
    const left = Math.max(bounds.left + inset, Math.min(anchor.left, bounds.right - inset - menu.offsetWidth));
    menu.style.top = `${Math.min(bounds.bottom - inset, Math.max(bounds.top + inset, top))}px`;
    menu.style.left = `${left}px`;
  };

  place();
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; place(); });
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(panel);
  resize.observe(trigger);
  resize.observe(menu);
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { attributeFilter: ["style", "class"] });
  observer.observe(trigger, { attributeFilter: ["style", "class"] });
  panel.addEventListener("scroll", schedule);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    resize.disconnect();
    observer.disconnect();
    panel.removeEventListener("scroll", schedule);
    if (menu.matches(":popover-open")) menu.hidePopover();
  };
}
