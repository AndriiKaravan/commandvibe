export type ViewerRelation = 'outsider' | 'pending' | 'removed' | 'member' | 'owner';

export interface PhotoViewer {
  relation: ViewerRelation;
  /** Also set for an organizer who plays. */
  memberId?: string;
  /** The viewer has a submission for the day that is not hidden. */
  ownVisibleSubmission: boolean;
}

export interface PhotoSubject {
  authorMemberId: string;
  authorActive: boolean;
  hidden: boolean;
  openComplaints: number;
}

export interface PhotoAccess {
  listed: boolean;
  image: 'full' | 'blur' | 'none';
  /** Whether the viewer sees the moderation data (takenBefore, source, complaint count). */
  moderation: boolean;
}

const denied: PhotoAccess = { listed: false, image: 'none', moderation: false };

/**
 * The single source of truth for who sees which version of a photo.
 * Used both when a day's list is built and when a file is served, so the two cannot disagree.
 */
export function decidePhotoAccess(viewer: PhotoViewer, photo: PhotoSubject, revealed: boolean): PhotoAccess {
  if (viewer.relation !== 'member' && viewer.relation !== 'owner') {
    return denied;
  }
  const isOwner = viewer.relation === 'owner';
  if (viewer.memberId !== undefined && viewer.memberId === photo.authorMemberId) {
    return { listed: true, image: 'full', moderation: isOwner };
  }
  const unblurred = revealed || viewer.ownVisibleSubmission;
  if (!isOwner) {
    if (photo.hidden || !photo.authorActive) {
      return denied;
    }
    return { listed: true, image: unblurred ? 'full' : 'blur', moderation: false };
  }
  // Hiding alone never unblurs: otherwise "hide, look, restore" would dodge the blur.
  const reviewing = photo.openComplaints > 0;
  return { listed: true, image: unblurred || reviewing ? 'full' : 'blur', moderation: true };
}
