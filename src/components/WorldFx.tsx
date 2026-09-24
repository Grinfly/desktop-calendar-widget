import { useEffect, useRef } from "react";
import type { WorldEvent } from "../extensions/types";
import "../styles/world-fx.css";

interface WorldFxProps {
  event: WorldEvent | undefined;
  active?: boolean;
}

const PARTICLE_COUNTS: Record<string, number> = {
  rain: 22,
  heavyRain: 28,
  snow: 24, // 24 片雪花，连绵不绝
  wind: 12,
  storm: 22,
  earthquake: 0,
  solarFlare: 0,
};

/** 方案 D1: 随风轻拂六棱纯白雪花 (双轴解耦·负延迟预热·丝滑永不停歇) */
function HexagonalSnowflake({ index, total = 24 }: { index: number; total?: number }) {
  const sizeMin = 15;
  const sizeMax = 22;
  const size = sizeMin + ((index * 3) % (sizeMax - sizeMin + 1)); // 15px ~ 22px
  const left = ((index * 17) % 86) + 7; // 7% ~ 93% 错落分布

  // 1. 垂直持续下落基准时间与精确交错负延迟预热（全屏均匀分布，绝不停滞断档）
  const fallDuration = 4.2 + (index % 6) * 0.45; // 4.2s ~ 6.5s
  const staggerDelay = -((index / total) * fallDuration).toFixed(2);

  // 2. 景深层次半透明：大雪花更近更分明，小雪花更远更轻透 (0.50 ~ 0.80)
  const depthRatio = (size - sizeMin) / (sizeMax - sizeMin || 1);
  const particleAlpha = (0.50 + depthRatio * 0.30).toFixed(2);

  // 3. 中层微风轻柔来回摆动 (X轴正弦摆动，柔和顺畅)
  const swayDuration = (2.6 + (index % 4) * 0.5).toFixed(2); // 2.6s ~ 4.1s
  const swayDelay = -((index * 0.8) % parseFloat(swayDuration)).toFixed(2);

  // 4. 内层自转速度
  const spinDuration = (8.5 + ((index * 1.1) % 6.0)).toFixed(1);

  return (
    <div
      className="snow-crystal"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        left: `${left}%`,
        animationDuration: `${fallDuration}s`,
        animationDelay: `${staggerDelay}s`,
        ["--particle-opacity" as any]: particleAlpha,
      }}
    >
      <div
        className="snow-sway-wrap"
        style={{
          animationDuration: `${swayDuration}s`,
          animationDelay: `${swayDelay}s`,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animationDuration: `${spinDuration}s` }}
        >
          <defs>
            <g id={`snow-branch-${index % 3}`}>
              <line x1="12" y1="12" x2="12" y2="2.2" />
              <path d="M8.8 3.8 L12 5.8 L15.2 3.8" />
              <path d="M8.8 7.2 L12 9.2 L15.2 7.2" />
            </g>
          </defs>
          <use href={`#snow-branch-${index % 3}`} />
          <use href={`#snow-branch-${index % 3}`} transform="rotate(60 12 12)" />
          <use href={`#snow-branch-${index % 3}`} transform="rotate(120 12 12)" />
          <use href={`#snow-branch-${index % 3}`} transform="rotate(180 12 12)" />
          <use href={`#snow-branch-${index % 3}`} transform="rotate(240 12 12)" />
          <use href={`#snow-branch-${index % 3}`} transform="rotate(300 12 12)" />
        </svg>
      </div>
    </div>
  );
}

export function WorldFx({ event, active = true }: WorldFxProps) {
  const shakeRef = useRef(false);

  // 地震轻微震动
  useEffect(() => {
    if (event?.type !== "earthquake" || shakeRef.current) return;
    const shell = document.querySelector(".widget-shell");
    if (!shell) return;
    shakeRef.current = true;
    shell.classList.add("earthquake-shake");
    const onEnd = () => {
      shell.classList.remove("earthquake-shake");
      shakeRef.current = false;
    };
    shell.addEventListener("animationend", onEnd, { once: true });
    return () => {
      shell.removeEventListener("animationend", onEnd);
    };
  }, [event]);

  // 如果没有事件，或者正在设置中，不显示干扰
  if (!event || !active) return null;

  const count = PARTICLE_COUNTS[event.type] ?? 0;

  return (
    <div
      className={`world-fx world-fx-${event.type}`}
      style={{ "--intensity": event.intensity } as React.CSSProperties}
      aria-hidden
    >
      {event.type === "snow"
        ? Array.from({ length: count }, (_, i) => (
            <HexagonalSnowflake key={i} index={i} total={count} />
          ))
        : Array.from({ length: count }, (_, i) => <span key={i} />)}
    </div>
  );
}
