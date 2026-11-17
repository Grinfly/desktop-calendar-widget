import { useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function SmallBeanButton({ disabled, error, onOpen }: {
  disabled: boolean;
  error: string | null;
  onOpen: () => void;
}) {
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const label = "打开今日待办";
  return (
    <main className="small-bean">
      <button
        type="button"
        aria-label={label}
        title={error ?? label}
        disabled={disabled}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragged.current = false;
          gesture.current = { id: event.pointerId, x: event.screenX, y: event.screenY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (start?.id !== event.pointerId || !(event.buttons & 1)) return;
          if (Math.hypot(event.screenX - start.x, event.screenY - start.y) < 5) return;
          dragged.current = true;
          gesture.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          void getCurrentWindow().startDragging().catch((cause) => console.error("拖动小蚕豆失败", cause));
        }}
        onLostPointerCapture={() => { gesture.current = null; }}
        onClick={(event) => {
          if (event.detail === 0 || !dragged.current) onOpen();
        }}
      >
        <img src="/favicon.png" alt="" draggable={false} />
      </button>
    </main>
  );
}
