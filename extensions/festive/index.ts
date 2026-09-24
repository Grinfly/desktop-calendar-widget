import { Solar } from "lunar-javascript";

export type DayAtmosphere =
  | "eveSnow"
  | "springFu"
  | "yuanxiaoSpark"
  | "qingmingRain"
  | "duanwuLeaf"
  | "qixiStars"
  | "midautumnMoon"
  | "chongyangPetal"
  | "yuandanConfetti"
  | "guoqingRibbon";

const BY_NAME: { needle: string; kind: DayAtmosphere }[] = [
  { needle: "除夕", kind: "eveSnow" },
  { needle: "春节", kind: "springFu" },
  { needle: "元宵", kind: "yuanxiaoSpark" },
  { needle: "清明", kind: "qingmingRain" },
  { needle: "端午", kind: "duanwuLeaf" },
  { needle: "七夕", kind: "qixiStars" },
  { needle: "中秋", kind: "midautumnMoon" },
  { needle: "重阳", kind: "chongyangPetal" },
  { needle: "元旦", kind: "yuandanConfetti" },
  { needle: "国庆", kind: "guoqingRibbon" },
];

function fromNames(names: string[]): DayAtmosphere | undefined {
  for (const { needle, kind } of BY_NAME) {
    if (names.some((name) => name.includes(needle))) return kind;
  }
  return undefined;
}

function fromLunarDate(month: number, day: number): DayAtmosphere | undefined {
  const m = Math.abs(month);
  if (m === 1 && day === 1) return "springFu";
  if (m === 1 && day === 15) return "yuanxiaoSpark";
  if (m === 5 && day === 5) return "duanwuLeaf";
  if (m === 7 && day === 7) return "qixiStars";
  if (m === 8 && day === 15) return "midautumnMoon";
  if (m === 9 && day === 9) return "chongyangPetal";
  return undefined;
}

export function getDayAtmosphere(date: Date): DayAtmosphere | undefined {
  const solar = Solar.fromYmd(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  const lunar = solar.getLunar();
  const names = [
    ...solar.getFestivals(),
    ...lunar.getFestivals(),
    lunar.getJieQi(),
  ].filter(Boolean);

  return (
    fromNames(names) ??
    fromLunarDate(lunar.getMonth(), lunar.getDay()) ??
    (date.getMonth() === 0 && date.getDate() === 1
      ? "yuandanConfetti"
      : date.getMonth() === 9 && date.getDate() === 1
        ? "guoqingRibbon"
        : undefined)
  );
}
