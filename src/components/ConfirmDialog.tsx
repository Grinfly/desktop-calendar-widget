import { useEffect } from "react";

interface ConfirmDialogProps {
  target: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  target,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div id="confirm-message" className="confirm-message">
          确定删除「<span className="confirm-target">{target}</span>」吗？
        </div>
        <div className="confirm-actions">
          <button type="button" className="confirm-btn cancel" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="confirm-btn danger"
            onClick={onConfirm}
            autoFocus
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
