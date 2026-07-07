import { Tooltip } from "./Tooltip";

interface TodayMonthButtonProps {
  active?: boolean;
  onGoToTodayMonth: () => void;
}

export function TodayMonthButton({
  active = false,
  onGoToTodayMonth,
}: TodayMonthButtonProps) {
  return (
    <Tooltip content="回到本月">
      <button
        type="button"
        className={`today-month-button ${active ? "active" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onGoToTodayMonth();
        }}
      >
        <img
          src="/favicon.png"
          alt=""
          className="title-action-icon today-month-icon"
          width={18}
          height={18}
          draggable={false}
        />
      </button>
    </Tooltip>
  );
}
