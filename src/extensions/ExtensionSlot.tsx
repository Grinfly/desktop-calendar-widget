import { useEffect, useRef } from "react";
import { useExtensions } from "./ExtensionContext";
import type { RegisteredPanel } from "./runtime";
import "./extensions.css";

function Panel({ panel }: { panel: RegisteredPanel }) {
  const container = useRef<HTMLDivElement>(null);
  const { mountPanel } = useExtensions();
  const mount = useRef(mountPanel);
  mount.current = mountPanel;
  useEffect(() => {
    if (container.current) return mount.current(panel, container.current);
  }, [panel]);
  return (
    <section className="extension-panel" aria-label={panel.title}>
      <h3 className="extension-panel-title">{panel.title}</h3>
      <div ref={container} />
    </section>
  );
}

export function ExtensionSlot({ slot, extensionId }: {
  slot: RegisteredPanel["slot"];
  extensionId?: string;
}) {
  const { panels } = useExtensions();
  const matching = panels.filter((panel) => panel.slot === slot && (!extensionId || panel.extensionId === extensionId));
  if (!matching.length) return null;
  return (
    <div className={`extension-slot extension-slot-${slot}`}>
      {matching.map((panel) => <Panel key={`${panel.extensionId}:${panel.id}`} panel={panel} />)}
    </div>
  );
}
