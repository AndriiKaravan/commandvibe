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
}

export const NOTIFICATION_SINK = Symbol('NotificationSink');
