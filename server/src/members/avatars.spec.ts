import { avatarIds, isAvatarId } from './avatars';

describe('avatar collection', () => {
  it('should offer 24 unique ids in the agreed format', () => {
    expect(avatarIds).toHaveLength(24);
    expect(new Set(avatarIds).size).toBe(24);
    for (const id of avatarIds) {
      expect(id).toMatch(/^av\d{2}$/);
    }
  });

  it('should recognise only ids from the collection', () => {
    expect(isAvatarId('av01')).toBe(true);
    expect(isAvatarId('av24')).toBe(true);
    for (const bad of ['av25', 'av00', 'AV01', '', null, undefined, 1, {}]) {
      expect(isAvatarId(bad)).toBe(false);
    }
  });
});
