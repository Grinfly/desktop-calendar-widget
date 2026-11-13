import type { ExtensionAPI } from "../../src/extensions/types";

/**
 * world-invasion 扩展
 *
 * 数据源：
 * - 天气：Open-Meteo（免费，无 Key，支持 CORS）
 * - 地震：USGS（免费，无 Key，支持 CORS）
 * - 太阳耀斑：NOAA SWPC（免费，无 Key，支持 CORS）
 */

interface WorldEventState {
  type:
    | "earthquake"
    | "solarFlare"
    | "rain"
    | "heavyRain"
    | "snow"
    | "storm"
    | "wind";
  intensity: number; // 0–1
  label: string;
  expiresAt: number; // Unix ms
}

// ─── 当前事件缓存 ───────────────────────────────────────────────────────────

let currentEvent: WorldEventState | undefined;
let extensionApi: ExtensionAPI;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const cancel = extensionApi.onCleanup(() => controller.abort());
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
    cancel();
  }
}

function setEvent(next: WorldEventState | undefined) {
  if (extensionApi.signal.aborted) return;
  currentEvent = next;
  extensionApi.invalidate();
  if (next) {
    console.log("[WorldInvasion] Active event set:", next);
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("world-event-change", { detail: next }));
    } catch {}
  }
}

// ─── 城市与坐标设置（真实所在地：天津市） ───────────────────────────────────

let userCity = "天津";
let userLat = 39.1424;
let userLon = 117.1727;

async function autoResolveDistrict(): Promise<void> {
  try {
    const data = await fetchJson<{ locality?: string; city?: string; principalSubdivision?: string; latitude?: number; longitude?: number }>(
      "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=zh"
    );
    if (extensionApi.signal.aborted) return;
    const district =
      data.locality ||
      data.city ||
      data.principalSubdivision;
    if (district && typeof data.latitude === "number" && typeof data.longitude === "number") {
      userCity = district;
      userLat = data.latitude;
      userLon = data.longitude;
      localStorage.setItem(
        "world-invasion:city-config",
        JSON.stringify({ city: userCity, lat: userLat, lon: userLon })
      );
      console.log("[WorldInvasion] Auto-resolved district location:", userCity, userLat, userLon);
      void checkWeather();
    }
  } catch (e) {
    console.warn("[WorldInvasion] Auto district resolution skipped:", e);
  }
}

function loadConfiguredLocation(): void {
  if (typeof localStorage === "undefined") return;
  const saved = localStorage.getItem("world-invasion:city-config");
  if (saved) {
    try {
      const cfg = JSON.parse(saved) as { city?: string; lat?: number; lon?: number };
      if (cfg.city && typeof cfg.lat === "number" && typeof cfg.lon === "number") {
        userCity = cfg.city;
        userLat = cfg.lat;
        userLon = cfg.lon;
        console.log("[WorldInvasion] Using saved city/district:", userCity, userLat, userLon);
        return;
      }
    } catch {}
  }
  // 未配置时先尝试后台自动定位到当前区/县
  void autoResolveDistrict();
}

// ─── Haversine 距离（km） ─────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── 天气 API（Open-Meteo WMO 代码映射） ──────────────────────────────────────

function wmoToEvent(
  code: number,
  windKph: number,
): Omit<WorldEventState, "expiresAt"> | undefined {
  // 雷暴/冰雹
  if (code >= 95)
    return {
      type: "storm",
      intensity: Math.min(0.6 + (code - 95) * 0.1, 1),
      label: `⚡ ${userCity} · 雷暴`,
    };
  // 阵雪
  if (code === 85 || code === 86)
    return {
      type: "snow",
      intensity: code === 86 ? 0.8 : 0.5,
      label: `🌨 ${userCity} · 阵雪`,
    };
  // 暴雨 / 强降水
  if ((code >= 63 && code <= 67) || code === 82)
    return {
      type: "heavyRain",
      intensity: Math.min(0.7 + (code - 63) * 0.08, 1),
      label: `🌧 ${userCity} · 大雨`,
    };
  // 阵雨 (80: 小阵雨, 81: 中阵雨)
  if (code >= 80 && code <= 84)
    return {
      type: "rain",
      intensity: 0.6 + (code - 80) * 0.1,
      label: `🌧 ${userCity} · 阵雨`,
    };
  // 降雪
  if (code >= 71 && code <= 77)
    return {
      type: "snow",
      intensity: Math.min(0.4 + (code - 71) * 0.08, 1),
      label: `❄️ ${userCity} · 降雪`,
    };
  // 毛毛雨/小雨/中雨
  if (code >= 51 && code <= 62)
    return {
      type: "rain",
      intensity: Math.min(0.4 + (code - 51) * 0.04, 0.75),
      label: code <= 57 ? `🌦 ${userCity} · 毛毛雨` : `🌧 ${userCity} · 降雨`,
    };
  // 大风（无降水但风速 > 45 kph）
  if (windKph > 45)
    return {
      type: "wind",
      intensity: Math.min((windKph - 45) / 45, 1),
      label: `💨 ${userCity} · 大风 ${Math.round(windKph)} km/h`,
    };
  return undefined;
}

async function checkWeather(): Promise<void> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${userLat}&longitude=${userLon}` +
      `&current=weathercode,windspeed_10m` +
      `&wind_speed_unit=kmh&timezone=auto`;
    const data = await fetchJson<{
      current?: { weathercode: number; windspeed_10m: number };
    }>(url);
    if (extensionApi.signal.aborted) return;
    if (!data.current) return;
    const { weathercode, windspeed_10m } = data.current;
    console.log("[WorldInvasion] Weather data:", userCity, weathercode, "wind:", windspeed_10m);
    const ev = wmoToEvent(weathercode, windspeed_10m);
    if (ev) {
      setEvent({ ...ev, expiresAt: Date.now() + 20 * 60 * 1000 });
    }
  } catch (e) {
    console.warn("[WorldInvasion] Weather fetch error:", e);
  }
}

// ─── 地震 API（USGS） ─────────────────────────────────────────────────────────

interface EqFeature {
  properties: { mag: number; place: string; time: number };
  geometry: { coordinates: [number, number, number] };
}

async function checkEarthquake(): Promise<void> {
  try {
    const url =
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
    const data = await fetchJson<{ features?: EqFeature[] }>(url);
    if (extensionApi.signal.aborted) return;
    if (!data.features) return;

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const f of data.features) {
      if (f.properties.time < oneHourAgo) break;
      const [lon, lat] = f.geometry.coordinates;
      const dist = haversineKm(userLat, userLon, lat, lon);
      if (dist > 1500) continue;

      const mag = f.properties.mag;
      if (mag < 3) continue;

      const intensity = Math.min((mag - 3) / 6, 1);
      setEvent({
        type: "earthquake",
        intensity,
        label: `🌋 M${mag.toFixed(1)} ${f.properties.place}`,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      break;
    }
  } catch (e) {
    console.warn("[WorldInvasion] Earthquake fetch error:", e);
  }
}

// ─── 太阳耀斑 API（NOAA SWPC） ────────────────────────────────────────────────

interface SwpcAlert {
  product_id: string;
  issue_datetime: string;
  message: string;
}

function parseFlareIntensity(id: string): number {
  if (id.startsWith("ALTK")) {
    const kp = parseInt(id.slice(4), 10);
    return Math.min((kp - 5) / 4, 1);
  }
  if (id.startsWith("ALTEF")) {
    const level = parseInt(id.slice(5), 10);
    return Math.min(level / 5, 1);
  }
  return 0.5;
}

async function checkSolarFlare(): Promise<void> {
  try {
    const url = "https://services.swpc.noaa.gov/products/alerts.json";
    const alerts = await fetchJson<SwpcAlert[]>(url);
    if (extensionApi.signal.aborted) return;
    if (!Array.isArray(alerts)) return;

    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    for (const alert of alerts) {
      const isFlare =
        alert.product_id.startsWith("ALTEF") ||
        alert.product_id.startsWith("ALTK");
      if (!isFlare) continue;

      const issueTime = new Date(alert.issue_datetime).getTime();
      if (issueTime < sixHoursAgo) continue;

      const intensity = parseFlareIntensity(alert.product_id);
      const label = alert.product_id.startsWith("ALTK")
        ? `☀️ 地磁暴 Kp${alert.product_id.slice(4)}`
        : `☀️ 太阳耀斑`;

      setEvent({
        type: "solarFlare",
        intensity,
        label,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
      break;
    }
  } catch (e) {
    console.warn("[WorldInvasion] Solar flare fetch error:", e);
  }
}

// ─── 公共导出 ─────────────────────────────────────────────────────────────────

export async function init(api: ExtensionAPI): Promise<void> {
  extensionApi = api;
  currentEvent = undefined;
  console.log("[WorldInvasion] Initializing extension for", userCity);
  loadConfiguredLocation();

  // 监听城市切换事件
  if (typeof window !== "undefined") {
    window.addEventListener("world-invasion:set-city", ((e: CustomEvent<{ city: string; lat: number; lon: number }>) => {
      if (e.detail && e.detail.city) {
        userCity = e.detail.city;
        userLat = e.detail.lat;
        userLon = e.detail.lon;
        localStorage.setItem("world-invasion:city-config", JSON.stringify(e.detail));
        console.log("[WorldInvasion] City switched to:", userCity);
        void checkWeather();
      }
    }) as EventListener, { signal: api.signal });

    // 监听手动模拟
    window.addEventListener("world-invasion:simulate", ((e: CustomEvent<WorldEventState | undefined>) => {
      setEvent(e.detail);
    }) as EventListener, { signal: api.signal });
  }

  // 立即检查天气
  void checkWeather();

  // 并行获取其他事件
  void Promise.allSettled([
    checkEarthquake(),
    checkSolarFlare(),
  ]);

  // 定时轮询
  api.timers.setInterval(() => void checkWeather(), 10 * 60 * 1000);
  api.timers.setInterval(() => void checkEarthquake(), 10 * 60 * 1000);
  api.timers.setInterval(() => void checkSolarFlare(), 30 * 60 * 1000);
}

export function getWorldEvent(): WorldEventState | undefined {
  if (currentEvent && currentEvent.expiresAt < Date.now()) {
    currentEvent = undefined;
  }
  return currentEvent;
}
