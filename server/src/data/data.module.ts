import { DynamicModule, Module } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firestoreDatabaseId } from './firestore-database';
import { createFirestoreRepositories } from './firestore/firestore-repositories';
import { createMemoryRepositories } from './memory/memory-repositories';
import { CELLS, COMPLAINTS, GROUPS, MEMBERS, ORGANIZERS, SESSIONS, SUBMISSIONS } from './repositories';

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
    ];
    return { module: DataModule, global: true, providers, exports: providers };
  }
}
