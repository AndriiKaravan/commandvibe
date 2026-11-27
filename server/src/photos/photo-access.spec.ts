import { PhotoAccess, PhotoSubject, PhotoViewer, ViewerRelation, decidePhotoAccess } from './photo-access';

const none: PhotoAccess = { listed: false, image: 'none', moderation: false };

interface Scenario {
  relation: ViewerRelation;
  isAuthor: boolean;
  ownVisibleSubmission: boolean;
  revealed: boolean;
  hidden: boolean;
  openComplaints: number;
  authorActive: boolean;
}

const relations: ViewerRelation[] = ['outsider', 'pending', 'removed', 'member', 'owner'];
const bools = [false, true];

const scenarios: Scenario[] = [];
for (const relation of relations) {
  for (const isAuthor of bools) {
    for (const ownVisibleSubmission of bools) {
      for (const revealed of bools) {
        for (const hidden of bools) {
          for (const openComplaints of [0, 1]) {
            for (const authorActive of bools) {
              scenarios.push({
                relation,
                isAuthor,
                ownVisibleSubmission,
                revealed,
                hidden,
                openComplaints,
                authorActive,
              });
            }
          }
        }
      }
    }
  }
}

/** The matrix of the plan, one row per viewer kind, written out independently of the implementation. */
function expected(s: Scenario): PhotoAccess {
  if (s.relation === 'outsider' || s.relation === 'pending' || s.relation === 'removed') {
    return none;
  }
  if (s.isAuthor) {
    return { listed: true, image: 'full', moderation: s.relation === 'owner' };
  }
  if (s.relation === 'member') {
    if (s.hidden || !s.authorActive) {
      return none;
    }
    return { listed: true, image: s.revealed || s.ownVisibleSubmission ? 'full' : 'blur', moderation: false };
  }
  // The owner: listed even when hidden or the author is gone; a complaint opens the full photo.
  const full = s.revealed || s.ownVisibleSubmission || s.openComplaints > 0;
  return { listed: true, image: full ? 'full' : 'blur', moderation: true };
}

const label = (s: Scenario): string => JSON.stringify(s);

function decide(s: Scenario): PhotoAccess {
  const viewer: PhotoViewer = {
    relation: s.relation,
    memberId: 'viewer',
    ownVisibleSubmission: s.ownVisibleSubmission,
  };
  const photo: PhotoSubject = {
    authorMemberId: s.isAuthor ? 'viewer' : 'author',
    authorActive: s.authorActive,
    hidden: s.hidden,
    openComplaints: s.openComplaints,
  };
  return decidePhotoAccess(viewer, photo, s.revealed);
}

describe('decidePhotoAccess', () => {
  it.each(scenarios.map((s) => [label(s), s] as const))('should follow the matrix for %s', (_name, s) => {
    expect(decide(s)).toEqual(expected(s));
  });

  const base: Scenario = {
    relation: 'member',
    isAuthor: false,
    ownVisibleSubmission: false,
    revealed: false,
    hidden: false,
    openComplaints: 0,
    authorActive: true,
  };

  it("should blur another's photo for a member who has not submitted before reveal", () => {
    expect(decide(base)).toEqual({ listed: true, image: 'blur', moderation: false });
  });

  it('should show it in full after own submission', () => {
    expect(decide({ ...base, ownVisibleSubmission: true }).image).toBe('full');
  });

  it('should not count an own hidden submission', () => {
    // The caller passes ownVisibleSubmission=false for a hidden own photo; the photo stays blurred.
    expect(decide({ ...base, ownVisibleSubmission: false }).image).toBe('blur');
  });

  it('should show it in full to everyone in the group after reveal', () => {
    for (const relation of ['member', 'owner'] as const) {
      expect(decide({ ...base, relation, revealed: true }).image).toBe('full');
    }
  });

  it('should blur it for an owner who does not play, until a complaint is open', () => {
    const owner = { ...base, relation: 'owner' as const };
    expect(decide(owner).image).toBe('blur');
    expect(decide({ ...owner, openComplaints: 1 }).image).toBe('full');
  });

  it('should not unblur a photo for the owner just because it is hidden', () => {
    const owner = { ...base, relation: 'owner' as const, hidden: true };
    expect(decide(owner)).toEqual({ listed: true, image: 'blur', moderation: true });
  });

  it('should give moderation data to the owner only', () => {
    expect(decide({ ...base, relation: 'owner' }).moderation).toBe(true);
    expect(decide({ ...base, revealed: true }).moderation).toBe(false);
    expect(decide({ ...base, isAuthor: true }).moderation).toBe(false);
  });

  it('should not list hidden photos or photos of removed authors to members', () => {
    expect(decide({ ...base, hidden: true })).toEqual(none);
    expect(decide({ ...base, authorActive: false })).toEqual(none);
  });

  it('should deny pending, removed and outsider viewers everything', () => {
    for (const relation of ['pending', 'removed', 'outsider'] as const) {
      expect(decide({ ...base, relation, revealed: true, openComplaints: 1 })).toEqual(none);
    }
  });
});
