import { useEffect } from "react";

import { APP_VERSION } from "../lib/version";

interface SettingsPanelProps {
  backgroundOpacity: number;
  onBackgroundOpacityChange: (value: number) => void;
  onClose: () => void;
}

export function SettingsPanel({
  backgroundOpacity,
  onBackgroundOpacityChange,
  onClose,
}: SettingsPanelProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section className="settings-panel" aria-label="设置">
      <div className="settings-toolbar">
        <h2 className="settings-title">设置</h2>
      </div>

      <div className="settings-section">
        <label className="settings-label" htmlFor="background-opacity">
          背景不透明度
        </label>
        <div className="settings-slider-row">
          <input
            id="background-opacity"
            className="settings-slider"
            type="range"
            min={20}
            max={100}
            step={1}
            value={backgroundOpacity}
            onChange={(event) =>
              onBackgroundOpacityChange(Number(event.target.value))
            }
          />
          <span className="settings-value">{backgroundOpacity}%</span>
        </div>
        <p className="settings-hint">数值越低，背景越透明，可透出桌面壁纸。</p>
      </div>

      <p className="settings-version">蚕豆 v{APP_VERSION}</p>
    </section>
  );
}
