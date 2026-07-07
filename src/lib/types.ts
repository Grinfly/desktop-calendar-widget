export interface Task {
  id: string;
  title: string;
  done: boolean;
  note: string;
  color?: string;
}

export interface TaskProgress {
  total: number;
  done: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type PinMode = "floating" | "desktop";
export type AppView = "calendar" | "tasks";

export interface AppSettings {
  pinMode: PinMode;
  position: Position;
  size: Size;
  lastView: AppView;
  selectedDate: string;
  backgroundOpacity: number;
}

export interface AppData {
  tasks: Record<string, Task[]>;
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  pinMode: "floating",
  position: { x: 120, y: 80 },
  size: { width: 300, height: 360 },
  lastView: "calendar",
  selectedDate: "",
  backgroundOpacity: 100,
};

export const DEFAULT_APP_DATA: AppData = {
  tasks: {},
  settings: DEFAULT_SETTINGS,
};
