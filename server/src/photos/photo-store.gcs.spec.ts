import { getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { GcsPhotoStore } from './gcs-photo-store';
import { describePhotoStore } from './photo-store.contract';

// Needs `firebase emulators:exec --only storage "npx jest src/photos/photo-store"` (Java required).
if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  describePhotoStore('gcs', async () => {
    const app =
      getApps()[0] ?? initializeApp({ projectId: 'demo-commandvibe', storageBucket: 'demo-commandvibe.appspot.com' });
    return new GcsPhotoStore(getStorage(app).bucket());
  });
} else {
  describe('gcs photo store', () => {
    it.skip('should run against the Storage emulator (FIREBASE_STORAGE_EMULATOR_HOST not set)', () => undefined);
  });
}
