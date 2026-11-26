import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createFirestoreRepositories } from './firestore/firestore-repositories';
import { describeRepositories } from './repositories.contract';

// Needs `firebase emulators:exec --only firestore "npx jest src/data"` (Java required).
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

if (emulator) {
  describeRepositories('firestore', async () => {
    const app = getApps()[0] ?? initializeApp({ projectId: 'demo-commandvibe' });
    return createFirestoreRepositories(getFirestore(app));
  });
} else {
  describe('firestore repositories', () => {
    it.skip('should run against the Firestore emulator (FIRESTORE_EMULATOR_HOST not set)', () => undefined);
  });
}
