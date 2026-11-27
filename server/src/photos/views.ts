import { UploadSource } from '../data/models';

export interface SubmissionModeration {
  takenBefore: boolean;
  takenAt?: string;
  source: UploadSource;
  openComplaints: number;
}

export interface SubmissionView {
  memberId: string;
  displayName: string;
  submittedAt: string;
  access: 'full' | 'blur';
  /** Only for `full`; a short-lived link to the server. */
  photoUrl?: string;
  blurUrl: string;
  width: number;
  height: number;
  mine: boolean;
  /** Author only: needed to replace the photo. */
  version?: string;
  /** Author and owner. */
  status?: 'visible' | 'hidden';
  /** Owner only. */
  moderation?: SubmissionModeration;
}

export interface DaySubmissionsView {
  dayIndex: number;
  revealAt: string;
  revealed: boolean;
  canSubmit: boolean;
  mine?: SubmissionView;
  /** Everyone else's visible photos, oldest first. */
  items: SubmissionView[];
  /** Visible submissions of the day, whoever is looking. */
  total: number;
  serverTime: string;
}
