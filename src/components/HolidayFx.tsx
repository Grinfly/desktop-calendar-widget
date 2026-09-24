import type { DayAtmosphere } from "../extensions/types";
import sceneChongyang from "../assets/holiday/scene-chongyang.webp";
import sceneDuanwu from "../assets/holiday/scene-duanwu.webp";
import sceneEve from "../assets/holiday/scene-eve.webp";
import sceneGuoqing from "../assets/holiday/scene-guoqing.webp";
import sceneMidautumn from "../assets/holiday/scene-midautumn.webp";
import sceneQingming from "../assets/holiday/scene-qingming.webp";
import sceneQixi from "../assets/holiday/scene-qixi.webp";
import sceneSpring from "../assets/holiday/scene-spring.webp";
import sceneYuandan from "../assets/holiday/scene-yuandan.webp";
import sceneYuanxiao from "../assets/holiday/scene-yuanxiao.webp";

const SCENES: Record<DayAtmosphere, string> = {
  eveSnow: sceneEve,
  springFu: sceneSpring,
  yuanxiaoSpark: sceneYuanxiao,
  qingmingRain: sceneQingming,
  duanwuLeaf: sceneDuanwu,
  qixiStars: sceneQixi,
  midautumnMoon: sceneMidautumn,
  chongyangPetal: sceneChongyang,
  yuandanConfetti: sceneYuandan,
  guoqingRibbon: sceneGuoqing,
};

interface HolidayFxProps {
  kind: DayAtmosphere | undefined;
}

export function HolidayFx({ kind }: HolidayFxProps) {
  if (!kind) return null;

  return (
    <div className={`holiday-fx holiday-fx-${kind}`} aria-hidden>
      <img src={SCENES[kind]} alt="" className="holiday-fx-scene" />
    </div>
  );
}
