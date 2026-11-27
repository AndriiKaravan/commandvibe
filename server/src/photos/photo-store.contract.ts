import { PhotoStore, photoPaths } from './photo-store';

export function describePhotoStore(name: string, factory: () => Promise<PhotoStore>): void {
  describe(`${name} photo store`, () => {
    let store: PhotoStore;
    let seed = 0;
    // Unique group per test: a shared emulator bucket must not leak between tests.
    const group = () => `grp${Date.now().toString(36)}${seed++}`;

    beforeEach(async () => {
      store = await factory();
    });

    it('should return the same bytes it was given', async () => {
      const paths = photoPaths(group(), 1, 'm1', 'v1');
      const bytes = Buffer.from([0, 1, 2, 255, 254]);
      await store.put(paths.photo, bytes, 'image/jpeg');
      expect((await store.get(paths.photo))?.equals(bytes)).toBe(true);
    });

    it('should return undefined for a missing file', async () => {
      expect(await store.get(photoPaths(group(), 1, 'm1', 'nope').photo)).toBeUndefined();
    });

    it('should delete files and ignore missing ones', async () => {
      const paths = photoPaths(group(), 1, 'm1', 'v1');
      await store.put(paths.photo, Buffer.from('a'), 'image/jpeg');
      await store.delete([paths.photo, paths.blur]);
      expect(await store.get(paths.photo)).toBeUndefined();
    });

    it('should delete only its own prefix and count the files', async () => {
      const g = group();
      const mine = photoPaths(g, 1, 'm1', 'v1');
      const mineBlur = photoPaths(g, 1, 'm1', 'v2');
      const neighbour = photoPaths(g, 1, 'm2', 'v1');
      const otherGroup = photoPaths(group(), 1, 'm1', 'v1');
      for (const path of [mine.photo, mineBlur.blur, neighbour.photo, otherGroup.photo]) {
        await store.put(path, Buffer.from('x'), 'image/jpeg');
      }
      expect(await store.deletePrefix(mine.prefix)).toBe(2);
      expect(await store.get(mine.photo)).toBeUndefined();
      expect(await store.get(neighbour.photo)).toBeDefined();
      expect(await store.get(otherGroup.photo)).toBeDefined();
    });
  });
}
