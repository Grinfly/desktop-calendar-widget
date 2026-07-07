export interface TaskColorOption {
  id: string;
  label: string;
  bg: string;
  dot: string;
}

export const TASK_COLORS: TaskColorOption[] = [
  {
    id: "",
    label: "默认",
    bg: "rgba(196, 92, 62, 0.06)",
    dot: "rgba(196, 92, 62, 0.55)",
  },
  {
    id: "peach",
    label: "暖杏",
    bg: "rgba(196, 92, 62, 0.18)",
    dot: "#c45c3e",
  },
  {
    id: "sand",
    label: "沙米",
    bg: "rgba(210, 175, 120, 0.22)",
    dot: "#c49a4a",
  },
  {
    id: "sage",
    label: "薄荷",
    bg: "rgba(118, 152, 118, 0.18)",
    dot: "#6d9a6d",
  },
  {
    id: "sky",
    label: "天青",
    bg: "rgba(108, 148, 188, 0.18)",
    dot: "#5a8fbf",
  },
  {
    id: "rose",
    label: "雾玫",
    bg: "rgba(196, 118, 132, 0.18)",
    dot: "#c46a7a",
  },
  {
    id: "lavender",
    label: "淡紫",
    bg: "rgba(148, 132, 188, 0.18)",
    dot: "#8a74c4",
  },
  {
    id: "lemon",
    label: "柠黄",
    bg: "rgba(210, 188, 88, 0.22)",
    dot: "#c9b03a",
  },
];

const colorMap = new Map(TASK_COLORS.map((color) => [color.id, color]));

export function getTaskColorBg(colorId?: string): string {
  return colorMap.get(colorId ?? "")?.bg ?? TASK_COLORS[0].bg;
}

export function getTaskColorDot(colorId?: string): string {
  return colorMap.get(colorId ?? "")?.dot ?? TASK_COLORS[0].dot;
}

export function getTaskColorLabel(colorId?: string): string {
  return colorMap.get(colorId ?? "")?.label ?? TASK_COLORS[0].label;
}
