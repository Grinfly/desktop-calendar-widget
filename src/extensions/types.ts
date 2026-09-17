export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
}

export type DayBadge = "rest" | "work";

export interface ExtensionModule {
  getDaySubLabel?(date: Date): string | undefined;
  getDayBadge?(date: Date): DayBadge | undefined;
}
