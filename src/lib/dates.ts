import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { zhCN } from "date-fns/locale";

export const DATE_KEY_FORMAT = "yyyy-MM-dd";

export const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export function toDateKey(date: Date): string {
  return format(date, DATE_KEY_FORMAT);
}

export function parseDateKey(key: string): Date {
  return parseISO(key);
}

export function formatMonthTitle(date: Date): string {
  return format(date, "yyyy年M月", { locale: zhCN });
}

export function formatYearTitle(year: number): string {
  return `${year}年`;
}

export function formatDayTitle(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return format(date, "M月d日 EEEE", { locale: zhCN });
}

export function getCalendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function shiftMonth(month: Date, delta: number): Date {
  return addMonths(month, delta);
}

export function makeMonthDate(year: number, monthIndex: number): Date {
  return startOfMonth(new Date(year, monthIndex, 1));
}

export function getTodayMonth(): Date {
  return startOfMonth(new Date());
}

export function withYear(date: Date, year: number): Date {
  return setYear(date, year);
}

export function withYearMonth(date: Date, year: number, monthIndex: number): Date {
  return setMonth(setYear(date, year), monthIndex);
}

export { getMonth, getYear, isSameDay, isSameMonth, isToday };

export const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
