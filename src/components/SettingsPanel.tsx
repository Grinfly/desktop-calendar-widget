import { useEffect, useMemo, useState } from "react";

import { useExtensions } from "../extensions/ExtensionContext";
import { APP_VERSION } from "../lib/version";
import { ConfirmDialog } from "./ConfirmDialog";

interface CityInfo {
  name: string;
  lat: number;
  lon: number;
}

interface CityGroup {
  group: string;
  cities: CityInfo[];
}

export const CHINA_CITY_GROUPS: CityGroup[] = [
  {
    group: "常用",
    cities: [
      { name: "北京", lat: 39.9042, lon: 116.4074 },
      { name: "上海", lat: 31.2304, lon: 121.4737 },
      { name: "广州", lat: 23.1291, lon: 113.2644 },
      { name: "深圳", lat: 22.5431, lon: 114.0579 },
      { name: "天津", lat: 39.1424, lon: 117.1727 },
      { name: "杭州", lat: 30.2741, lon: 120.1551 },
      { name: "成都", lat: 30.5728, lon: 104.0668 },
      { name: "武汉", lat: 30.5928, lon: 114.3055 },
      { name: "南京", lat: 32.0603, lon: 118.7969 },
      { name: "西安", lat: 34.3416, lon: 108.9398 },
    ],
  },
  {
    group: "直辖市",
    cities: [
      { name: "北京", lat: 39.9042, lon: 116.4074 },
      { name: "上海", lat: 31.2304, lon: 121.4737 },
      { name: "天津", lat: 39.1424, lon: 117.1727 },
      { name: "重庆", lat: 29.5630, lon: 106.5516 },
    ],
  },
  {
    group: "华东",
    cities: [
      { name: "杭州", lat: 30.2741, lon: 120.1551 },
      { name: "宁波", lat: 29.8683, lon: 121.544 },
      { name: "南京", lat: 32.0603, lon: 118.7969 },
      { name: "苏州", lat: 31.299, lon: 120.5853 },
      { name: "无锡", lat: 31.4912, lon: 120.3119 },
      { name: "合肥", lat: 31.8206, lon: 117.2272 },
      { name: "福州", lat: 26.0745, lon: 119.2965 },
      { name: "厦门", lat: 24.4798, lon: 118.0894 },
      { name: "南昌", lat: 28.682, lon: 115.8579 },
      { name: "济南", lat: 36.6512, lon: 117.1201 },
      { name: "青岛", lat: 36.0671, lon: 120.3826 },
    ],
  },
  {
    group: "华南",
    cities: [
      { name: "广州", lat: 23.1291, lon: 113.2644 },
      { name: "深圳", lat: 22.5431, lon: 114.0579 },
      { name: "珠海", lat: 22.2707, lon: 113.5767 },
      { name: "佛山", lat: 23.0215, lon: 113.1214 },
      { name: "东莞", lat: 23.0207, lon: 113.7518 },
      { name: "南宁", lat: 22.817, lon: 108.3665 },
      { name: "桂林", lat: 25.2736, lon: 110.2902 },
      { name: "海口", lat: 20.044, lon: 110.1999 },
      { name: "三亚", lat: 18.2528, lon: 109.512 },
    ],
  },
  {
    group: "华中",
    cities: [
      { name: "武汉", lat: 30.5928, lon: 114.3055 },
      { name: "长沙", lat: 28.2282, lon: 112.9388 },
      { name: "郑州", lat: 34.7466, lon: 113.6254 },
      { name: "洛阳", lat: 34.6197, lon: 112.454 },
    ],
  },
  {
    group: "华北",
    cities: [
      { name: "石家庄", lat: 38.0428, lon: 114.5149 },
      { name: "唐山", lat: 39.6351, lon: 118.1754 },
      { name: "太原", lat: 37.8706, lon: 112.5489 },
      { name: "呼和浩特", lat: 40.8427, lon: 111.75 },
    ],
  },
  {
    group: "西南",
    cities: [
      { name: "成都", lat: 30.5728, lon: 104.0668 },
      { name: "绵阳", lat: 31.4675, lon: 104.6791 },
      { name: "贵阳", lat: 26.647, lon: 106.6302 },
      { name: "昆明", lat: 25.0406, lon: 102.7123 },
      { name: "拉萨", lat: 29.6525, lon: 91.1721 },
    ],
  },
  {
    group: "西北",
    cities: [
      { name: "西安", lat: 34.3416, lon: 108.9398 },
      { name: "兰州", lat: 36.0611, lon: 103.8343 },
      { name: "西宁", lat: 36.6171, lon: 101.7782 },
      { name: "银川", lat: 38.4872, lon: 106.2309 },
      { name: "乌鲁木齐", lat: 43.8256, lon: 87.6168 },
    ],
  },
  {
    group: "东北",
    cities: [
      { name: "沈阳", lat: 41.8057, lon: 123.4315 },
      { name: "大连", lat: 38.914, lon: 121.6147 },
      { name: "长春", lat: 43.8171, lon: 125.3235 },
      { name: "哈尔滨", lat: 45.8038, lon: 126.535 },
    ],
  },
  {
    group: "港澳台",
    cities: [
      { name: "香港", lat: 22.3193, lon: 114.1694 },
      { name: "澳门", lat: 22.1987, lon: 113.5439 },
      { name: "台北", lat: 25.033, lon: 121.5654 },
    ],
  },
];

function CityPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("常用");
  const [search, setSearch] = useState("");
  const [locating, setLocating] = useState(false);
  const [locateStatus, setLocateStatus] = useState<string | null>(null);
  const [remoteResults, setRemoteResults] = useState<
    { name: string; label: string; lat: number; lon: number }[]
  >([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  const [currentCity, setCurrentCity] = useState(() => {
    try {
      const saved = localStorage.getItem("world-invasion:city-config");
      return saved ? JSON.parse(saved).city || "天津" : "天津";
    } catch {
      return "天津";
    }
  });

  const handleSelect = (cityName: string, lat: number, lon: number) => {
    setCurrentCity(cityName);
    setIsOpen(false);
    setSearch("");
    setLocateStatus(null);
    window.dispatchEvent(
      new CustomEvent("world-invasion:set-city", {
        detail: { city: cityName, lat, lon },
      })
    );
  };

  // 自动定位到当前区/县
  const handleAutoLocate = async () => {
    setLocating(true);
    setLocateStatus("正在识别高精度位置...");
    try {
      let lat: number | null = null;
      let lon: number | null = null;

      // 1. 优先尝试系统高精度定位 (WiFi / GPS，精度可达具体街道区县)
      if (typeof navigator !== "undefined" && "geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 4000,
              maximumAge: 60000,
              enableHighAccuracy: true,
            });
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } catch {
          // 系统定位不可用或超时，降级走网络逆地理
        }
      }

      // 2. 调用免 Key 高精度逆地理 API 反解析出具体区县
      const url =
        lat && lon
          ? `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
          : `https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=zh`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("网络定位服务异常");
      const data = await res.json();

      // 优先获取具体的区/县级名称（如 清徐县、海淀区、龙华区）
      const districtName =
        data.locality ||
        data.city ||
        data.principalSubdivision ||
        "天津";
      const targetLat = data.latitude || lat || 39.1424;
      const targetLon = data.longitude || lon || 117.1727;

      handleSelect(districtName, targetLat, targetLon);
    } catch (e) {
      console.warn("[CityPicker] Auto locate error:", e);
      setLocateStatus("定位失败，可手动搜索区县");
    } finally {
      setLocating(false);
    }
  };

  // 在线搜索全国任意县/区
  useEffect(() => {
    const query = search.trim();
    if (!query || query.length < 2) {
      setRemoteResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingRemote(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&countrycodes=cn&format=json&addressdetails=1&accept-language=zh-Hans`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const list = data.slice(0, 6).map((item: any) => {
              const name = item.name || query;
              const parts = (item.display_name || "")
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
              // 显示为: 清徐县 (太原市)
              const parent = parts.length > 1 ? parts[1] : "";
              return {
                name,
                label: parent ? `${name} (${parent})` : name,
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
              };
            });
            setRemoteResults(list);
          }
        }
      } catch {
        // 网络异常不影响本地匹配
      } finally {
        setIsSearchingRemote(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  const allUniqueCities = useMemo(() => {
    const map = new Map<string, CityInfo>();
    CHINA_CITY_GROUPS.forEach((g) => {
      g.cities.forEach((c) => {
        if (!map.has(c.name)) map.set(c.name, c);
      });
    });
    return Array.from(map.values());
  }, []);

  const localFiltered = search.trim()
    ? allUniqueCities.filter((c) => c.name.includes(search.trim()))
    : (CHINA_CITY_GROUPS.find((g) => g.group === activeTab)?.cities ?? []);

  return (
    <div style={{ marginTop: 4, marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted)" }}>真实城市：</span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 6,
            border: "1px solid rgba(120, 85, 65, 0.25)",
            background: isOpen ? "rgba(196, 92, 62, 0.15)" : "var(--bg)",
            color: "var(--text)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            lineHeight: "18px",
          }}
        >
          <span>{currentCity}</span>
          <span
            style={{
              fontSize: 8,
              opacity: 0.6,
              transform: isOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.15s ease",
            }}
          >
            ▼
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            marginTop: 6,
            padding: "7px 8px",
            borderRadius: 7,
            border: "1px solid rgba(120, 85, 65, 0.2)",
            background: "rgba(196, 92, 62, 0.05)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* 自动定位按钮 */}
          <button
            type="button"
            onClick={() => void handleAutoLocate()}
            disabled={locating}
            style={{
              width: "100%",
              padding: "4px 8px",
              fontSize: 11,
              borderRadius: 4,
              border: "1px dashed rgba(196, 92, 62, 0.45)",
              background: locating
                ? "rgba(196, 92, 62, 0.15)"
                : "rgba(196, 92, 62, 0.06)",
              color: "var(--text)",
              cursor: locating ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span>{locating ? "正在识别区县定位..." : "🎯 自动定位到当前区/县"}</span>
          </button>
          {locateStatus ? (
            <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
              {locateStatus}
            </div>
          ) : null}

          {/* 搜索框：支持搜全国任意区/县 */}
          <input
            type="text"
            placeholder="搜索全国任意区/县 (如: 清徐县, 滨海新区)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "3px 6px",
              fontSize: 11,
              borderRadius: 4,
              border: "1px solid rgba(120, 85, 65, 0.2)",
              background: "var(--bg)",
              color: "var(--text)",
              outline: "none",
            }}
          />

          {!search.trim() && (
            <div
              style={{
                display: "flex",
                gap: 3,
                overflowX: "auto",
                paddingBottom: 2,
                scrollbarWidth: "none",
              }}
            >
              {CHINA_CITY_GROUPS.map((g) => (
                <button
                  key={g.group}
                  type="button"
                  onClick={() => setActiveTab(g.group)}
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    padding: "1px 5px",
                    borderRadius: 4,
                    border: "none",
                    cursor: "pointer",
                    background:
                      activeTab === g.group
                        ? "rgba(196, 92, 62, 0.25)"
                        : "transparent",
                    color:
                      activeTab === g.group ? "var(--text)" : "var(--muted)",
                    fontWeight: activeTab === g.group ? 600 : 400,
                  }}
                >
                  {g.group}
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              maxHeight: 96,
              overflowY: "auto",
              paddingRight: 2,
            }}
          >
            {/* 在线搜索全国区县结果 */}
            {remoteResults.length > 0 && (
              <div
                style={{
                  width: "100%",
                  fontSize: 10,
                  color: "var(--muted)",
                  marginBottom: 2,
                }}
              >
                全国区县匹配：
              </div>
            )}
            {remoteResults.map((r) => (
              <button
                key={`${r.name}-${r.lat}`}
                type="button"
                onClick={() => handleSelect(r.name, r.lat, r.lon)}
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: "1px solid rgba(196, 92, 62, 0.4)",
                  background: "rgba(196, 92, 62, 0.12)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {r.label}
              </button>
            ))}

            {/* 本地预置大中城市 */}
            {localFiltered.length > 0
              ? localFiltered.map((city) => {
                  const isSelected = city.name === currentCity;
                  return (
                    <button
                      key={city.name}
                      type="button"
                      onClick={() =>
                        handleSelect(city.name, city.lat, city.lon)
                      }
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: isSelected
                          ? "1px solid rgba(196, 92, 62, 0.45)"
                          : "1px solid rgba(120, 85, 65, 0.15)",
                        background: isSelected
                          ? "rgba(196, 92, 62, 0.22)"
                          : "var(--bg)",
                        color: "var(--text)",
                        cursor: "pointer",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {isSelected ? `✓ ${city.name}` : city.name}
                    </button>
                  );
                })
              : remoteResults.length === 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      padding: "4px",
                    }}
                  >
                    {isSearchingRemote ? "正在搜索全国区县..." : "未找到匹配区县"}
                  </span>
                )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SettingsPanelProps {
  backgroundOpacity: number;
  onBackgroundOpacityChange: (value: number) => void;
  showWorkRestBadges: boolean;
  onShowWorkRestBadgesChange: (value: boolean) => void;
  followWallpaper: boolean;
  onFollowWallpaperChange: (value: boolean) => void;
  followWallpaperText: boolean;
  onFollowWallpaperTextChange: (value: boolean) => void;
  onClose: () => void;
}

export function SettingsPanel({
  backgroundOpacity,
  onBackgroundOpacityChange,
  showWorkRestBadges,
  onShowWorkRestBadgesChange,
  followWallpaper,
  onFollowWallpaperChange,
  followWallpaperText,
  onFollowWallpaperTextChange,
  onClose,
}: SettingsPanelProps) {
  const { manifests, install, uninstall, worldEvent, error } = useExtensions();
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
        <div className="settings-toggle-row">
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={followWallpaper}
              onChange={(event) => onFollowWallpaperChange(event.target.checked)}
            />
            跟随壁纸配色
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={followWallpaper && followWallpaperText}
              disabled={!followWallpaper}
              onChange={(event) =>
                onFollowWallpaperTextChange(event.target.checked)
              }
            />
            文字颜色也跟随
          </label>
        </div>
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
              <li key={manifest.id} className="settings-ext-item">
                <div className="settings-ext-row">
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
                </div>
                {manifest.id === "lunar" ? (
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={showWorkRestBadges}
                      onChange={(event) =>
                        onShowWorkRestBadgesChange(event.target.checked)
                      }
                    />
                    显示班休
                  </label>
                ) : null}
                {manifest.id === "world-invasion" ? (
                  <div style={{ marginTop: 2 }}>
                    <CityPicker />
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      当前状态：{worldEvent ? <strong style={{ color: "var(--text)" }}>{worldEvent.label}</strong> : "🌤 晴朗平静"}
                    </div>
                  </div>
                ) : null}
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
