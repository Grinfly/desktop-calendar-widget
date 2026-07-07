import { Solar } from "lunar-javascript";

const FESTIVAL_SHORT_NAMES: Record<string, string> = {
  元旦节: "元旦",
  国庆节: "国庆",
  端午节: "端午",
  七夕节: "七夕",
  重阳节: "重阳",
  元宵节: "元宵",
  清明节: "清明",
  情人节: "情人节",
};

function formatLunarMonth(month: string): string {
  if (month === "正") return "正月";
  if (month === "冬") return "冬月";
  if (month === "腊") return "腊月";
  return `${month}月`;
}

function shortenFestival(name: string): string {
  return FESTIVAL_SHORT_NAMES[name] ?? name;
}

function pickFestival(names: string[]): string | undefined {
  const first = names.find(Boolean);
  return first ? shortenFestival(first) : undefined;
}

/** 日期下方副标题：节气/节日优先，否则农历月日 */
export function getDaySubLabel(date: Date): string {
  const solar = Solar.fromYmd(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  const lunar = solar.getLunar();

  const jieQi = lunar.getJieQi();
  if (jieQi) return jieQi;

  const festival = pickFestival([
    ...solar.getFestivals(),
    ...lunar.getFestivals(),
  ]);
  if (festival) return festival;

  const fu = lunar.getFu();
  if (fu && fu.getIndex() === 1) return fu.toString();

  if (lunar.getDay() === 1) {
    return formatLunarMonth(lunar.getMonthInChinese());
  }

  return lunar.getDayInChinese();
}

/** @deprecated 使用 getDaySubLabel */
export function getHolidayLabel(date: Date): string {
  return getDaySubLabel(date);
}
