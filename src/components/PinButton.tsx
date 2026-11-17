import { Tooltip } from "./Tooltip";
import type { PinMode } from "../lib/types";

interface PinButtonProps {
  mode: PinMode;
  simulated?: boolean;
  onToggle: () => void;
}

export function PinButton({ mode, onToggle, simulated = false }: PinButtonProps) {
  const pinned = mode === "floating";
  const label = pinned ? "取消置顶" : "置顶悬浮";

  return (
    <Tooltip content={simulated ? `模拟：${label}（系统置顶仅桌面版）` : label}>
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
        <svg
          className="title-action-icon pin-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 4h8M12 16v5" />
          <path d="M9 4h6l-1 6 3 4v2H7v-2l3-4-1-6Z" fill={pinned ? "currentColor" : "none"} />
        </svg>
      </button>
    </Tooltip>
  );
}
