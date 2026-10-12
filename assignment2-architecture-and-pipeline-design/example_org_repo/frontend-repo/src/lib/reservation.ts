export const DATE_TYPES = {
  coffee: {
    label: "Coffee",
    emoji: "☕",
    title: "☕ Coffee Date",
    durationMinutes: 90,
  },
  beer: {
    label: "Beer",
    emoji: "🍺",
    title: "🍺 Beer Date",
    durationMinutes: 120,
  },
  dinner: {
    label: "Dinner",
    emoji: "🍝",
    title: "🍝 Dinner Date",
    durationMinutes: 120,
  },
  movie: {
    label: "Movie",
    emoji: "🎬",
    title: "🎬 Movie Date",
    durationMinutes: 180,
  },
  "theme-park": {
    label: "Theme park",
    emoji: "🎡",
    title: "🎡 Theme Park Date",
    durationMinutes: 300,
  },
  other: {
    label: "Something else",
    emoji: "✨",
    title: "💖 Date",
    durationMinutes: 120,
  },
} as const;

export type DateType = keyof typeof DATE_TYPES;

export interface Reservation {
  invitePath: string;
  date: string;
  time: string;
  type: DateType;
  activity?: string;
}

export const dateTypes = Object.entries(DATE_TYPES).map(([value, details]) => ({
  value: value as DateType,
  ...details,
}));
