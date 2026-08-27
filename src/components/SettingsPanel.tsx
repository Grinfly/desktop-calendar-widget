import { useEffect, useState } from "react";

import { useExtensions } from "../extensions/ExtensionContext";
import { APP_VERSION } from "../lib/version";
import { ConfirmDialog } from "./ConfirmDialog";

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
  const { manifests, install, uninstall, error } = useExtensions();
  const [pendingUninstall, setPendingUninstall] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pendingUninstall) {
        event.stopImmediatePropagation();
        setPendingUninstall(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, pendingUninstall]);

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

      <div className="settings-section">
        <div className="settings-section-header">
          <h3 className="settings-label">扩展</h3>
          <button
            type="button"
            className="settings-action-button"
            onClick={() => void install()}
          >
            安装扩展…
          </button>
        </div>
        {manifests.length === 0 ? (
          <p className="settings-hint">
            尚未安装扩展。农历、节气和节日需单独下载安装。
          </p>
        ) : (
          <ul className="settings-ext-list">
            {manifests.map((manifest) => (
              <li key={manifest.id} className="settings-ext-row">
                <div className="settings-ext-copy">
                  <span className="settings-ext-name">{manifest.name}</span>
                  {manifest.description ? (
                    <span className="settings-ext-desc">
                      {manifest.description}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="settings-action-button danger"
                  onClick={() =>
                    setPendingUninstall({
                      id: manifest.id,
                      name: manifest.name,
                    })
                  }
                >
                  卸载
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="settings-error">{error}</p> : null}
      </div>

      <p className="settings-version">蚕豆 v{APP_VERSION}</p>

      {pendingUninstall ? (
        <ConfirmDialog
          target={pendingUninstall.name}
          onCancel={() => setPendingUninstall(null)}
          onConfirm={() => {
            const id = pendingUninstall.id;
            setPendingUninstall(null);
            void uninstall(id);
          }}
        />
      ) : null}
    </section>
  );
}
