import { Tooltip } from "./Tooltip";
import type { PinMode } from "../lib/types";

interface PinButtonProps {
  mode: PinMode;
  onToggle: () => void;
}

export function PinButton({ mode, onToggle }: PinButtonProps) {
  const pinned = mode === "floating";
  const label = pinned ? "取消置顶" : "置顶悬浮";

  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={`pin-button ${pinned ? "floating" : "desktop"}`}
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-pressed={pinned}
      >
        <span className="title-action-icon pin-icon" aria-hidden="true">
          📌
        </span>
      </button>
    </Tooltip>
  );
}
