import { Tooltip } from "./Tooltip";

interface SettingsButtonProps {
  active?: boolean;
  onOpen: () => void;
}

export function SettingsButton({ active = false, onOpen }: SettingsButtonProps) {
  return (
    <Tooltip content="设置">
      <button
        type="button"
        className={`settings-button ${active ? "active" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <span className="title-action-icon settings-icon" aria-hidden="true">
          ⚙
        </span>
      </button>
    </Tooltip>
  );
}
