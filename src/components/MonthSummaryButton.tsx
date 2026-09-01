import { Tooltip } from "./Tooltip";

interface MonthSummaryButtonProps {
  active?: boolean;
  onOpen: () => void;
}

export function MonthSummaryButton({
  active = false,
  onOpen,
}: MonthSummaryButtonProps) {
  return (
    <Tooltip content="本月总结">
      <button
        type="button"
        className={`month-summary-button ${active ? "active" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        aria-pressed={active}
      >
        <span className="title-action-icon" aria-hidden="true">
          ✎
        </span>
      </button>
    </Tooltip>
  );
}
