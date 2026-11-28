/** What game events tell the notification list; implemented by NotificationSources. */
export interface NotificationSink {
  dayOpened(groupId: string, dayIndex: number): Promise<void>;
  photosRevealed(groupId: string, dayIndex: number): Promise<void>;
  myTurn(groupId: string, dayIndex: number, memberId: string): Promise<void>;
  comment(
    groupId: string,
    dayIndex: number,
    photoAuthorId: string,
    commenterId: string,
    commentId: string,
  ): Promise<void>;
  likes(groupId: string, dayIndex: number, photoAuthorId: string): Promise<void>;
  pendingMember(groupId: string, memberId: string): Promise<void>;
  complaint(groupId: string, dayIndex: number, photoAuthorId: string): Promise<void>;
  /** True when a new reminder entry was made. */
  reminder(groupId: string, dayIndex: number, memberId: string): Promise<boolean>;
}

/** Runs the evening reminders; called from the Scheduler tick. */
export interface ReminderRunner {
  run(now: Date): Promise<number>;
}

export const REMINDER_RUNNER = Symbol('ReminderRunner');

export const NOTIFICATION_SINK = Symbol('NotificationSink');
