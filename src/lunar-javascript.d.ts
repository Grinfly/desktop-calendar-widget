declare module "lunar-javascript" {
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
