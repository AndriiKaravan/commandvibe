import { PointKind } from './points-engine';

export interface PointsEntryView {
  dayIndex: number;
  kind: PointKind;
  amount: number;
  detail?: number;
}

export interface PointsJournalView {
  total: number;
  entries: PointsEntryView[];
}
