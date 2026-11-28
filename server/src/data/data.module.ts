import { DynamicModule, Module } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { GcsPhotoStore } from '../photos/gcs-photo-store';
import { MemoryPhotoStore, PHOTO_STORE, PhotoStore } from '../photos/photo-store';
import { firestoreDatabaseId } from './firestore-database';
import { createFirestoreRepositories } from './firestore/firestore-repositories';
import { createMemoryRepositories } from './memory/memory-repositories';
import { CELLS, COMPLAINTS, GROUPS, LIKES, MEMBERS, ORGANIZERS, SESSIONS, SUBMISSIONS } from './repositories';

function photoStoreFor(storage: 'memory' | 'firestore'): PhotoStore {
  if (storage === 'memory') {
    return new MemoryPhotoStore();
  }
  const bucket = process.env.PHOTOS_BUCKET;
  if (!bucket) {
    throw new Error('PHOTOS_BUCKET must be set when the server stores data in Firestore');
  }
  return new GcsPhotoStore(getStorage(getApps()[0] ?? initializeApp()).bucket(bucket));
}

/** Provides the repositories; the rest of the server only sees their interfaces. */
@Module({})
export class DataModule {
  static forRoot(storage: 'memory' | 'firestore'): DynamicModule {
    const repos =
      storage === 'memory'
        ? createMemoryRepositories()
        : createFirestoreRepositories(getFirestore(getApps()[0] ?? initializeApp(), firestoreDatabaseId(process.env)));
    const providers = [
      { provide: CELLS, useValue: repos.cells },
      { provide: ORGANIZERS, useValue: repos.organizers },
      { provide: SESSIONS, useValue: repos.sessions },
      { provide: GROUPS, useValue: repos.groups },
      { provide: MEMBERS, useValue: repos.members },
      { provide: SUBMISSIONS, useValue: repos.submissions },
      { provide: COMPLAINTS, useValue: repos.complaints },
      { provide: LIKES, useValue: repos.likes },
      { provide: PHOTO_STORE, useValue: photoStoreFor(storage) },
    ];
    return { module: DataModule, global: true, providers, exports: providers };
  }
}
