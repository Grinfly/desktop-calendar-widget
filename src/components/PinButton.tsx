import { Tooltip } from "./Tooltip";

interface PinButtonProps {
  mode: "floating" | "desktop";
  onToggle: () => void;
}

export function PinButton({ mode, onToggle }: PinButtonProps) {
  const isDesktop = mode === "desktop";
  const label = isDesktop ? "取消置顶" : "置顶悬浮";

  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={`pin-button ${mode}`}
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-pressed={isDesktop}
      >
        <span className="title-action-icon pin-icon" aria-hidden="true">
          📌
        </span>
      </button>
    </Tooltip>
  );
}
