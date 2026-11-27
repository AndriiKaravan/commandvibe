import { MemoryPhotoStore, photoPaths } from './photo-store';
import { describePhotoStore } from './photo-store.contract';

describePhotoStore('memory', async () => new MemoryPhotoStore());

describe('photoPaths', () => {
  it('should build day-ordered paths under the group prefix', () => {
    expect(photoPaths('g1', 3, 'm9', 'abc')).toEqual({
      photo: 'groups/g1/cells/03/m9/abc/photo.jpg',
      blur: 'groups/g1/cells/03/m9/abc/blur.jpg',
      prefix: 'groups/g1/cells/03/m9/',
    });
  });
});
