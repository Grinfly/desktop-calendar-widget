import { Tooltip } from "./Tooltip";

interface LongTermTasksButtonProps {
  active?: boolean;
  onOpen: () => void;
}

export function LongTermTasksButton({
  active = false,
  onOpen,
}: LongTermTasksButtonProps) {
  return (
    <Tooltip content="长期待办">
      <button
        type="button"
        className={`long-term-button ${active ? "active" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        aria-pressed={active}
      >
        <span className="title-action-icon" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2.5" y="2" width="11" height="12" rx="2" />
            <path d="M5.5 5.5h5" />
            <path d="M5.5 8h5" />
            <path d="M5.5 10.5h3" />
          </svg>
        </span>
      </button>
    </Tooltip>
  );
}
