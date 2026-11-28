export interface DayProgressView {
  dayIndex: number;
  /** Visible photos of active players. */
  done: number;
  /** Active players. */
  total: number;
  /** Whether the viewer has a visible photo; null when the viewer does not play. */
  mine: boolean | null;
}

export interface ProgressView {
  days: DayProgressView[];
  serverTime: string;
}
