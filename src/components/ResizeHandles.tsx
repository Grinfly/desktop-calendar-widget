import { getCurrentWindow } from "@tauri-apps/api/window";

type ResizeDirection =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

const HANDLES: Array<{ className: string; direction: ResizeDirection }> = [
  { className: "resize-n", direction: "North" },
  { className: "resize-s", direction: "South" },
  { className: "resize-e", direction: "East" },
  { className: "resize-w", direction: "West" },
  { className: "resize-ne", direction: "NorthEast" },
  { className: "resize-nw", direction: "NorthWest" },
  { className: "resize-se", direction: "SouthEast" },
  { className: "resize-sw", direction: "SouthWest" },
];

export function ResizeHandles() {
  const startResize = (direction: ResizeDirection) => {
    void getCurrentWindow().startResizeDragging(direction);
  };

  return (
    <div className="resize-handles" aria-hidden="true">
      {HANDLES.map((handle) => (
        <div
          key={handle.className}
          className={`resize-handle ${handle.className}`}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            startResize(handle.direction);
          }}
        />
      ))}
    </div>
  );
}
