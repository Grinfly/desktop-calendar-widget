declare module "lunar-javascript" {
  export class Holiday {
    isWork(): boolean;
    getName(): string;
  }

  export class HolidayUtil {
    static getHoliday(
      year: number,
      month: number,
      day: number,
    ): Holiday | null;
  }

  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
    getFestivals(): string[];
  }

  export class Lunar {
    getDay(): number;
    getJieQi(): string;
    getDayInChinese(): string;
    getMonthInChinese(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    getFu(): { toString(): string; getIndex(): number } | null;
  }
}
