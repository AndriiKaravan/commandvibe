import { DynamicModule, Module } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createFirestoreRepositories } from './firestore/firestore-repositories';
import { createMemoryRepositories } from './memory/memory-repositories';
import { GROUPS, MEMBERS, ORGANIZERS, SESSIONS } from './repositories';

/** Provides the repositories; the rest of the server only sees their interfaces. */
@Module({})
export class DataModule {
  static forRoot(storage: 'memory' | 'firestore'): DynamicModule {
    const repos =
      storage === 'memory'
        ? createMemoryRepositories()
        : createFirestoreRepositories(getFirestore(getApps()[0] ?? initializeApp()));
    const providers = [
      { provide: ORGANIZERS, useValue: repos.organizers },
      { provide: SESSIONS, useValue: repos.sessions },
      { provide: GROUPS, useValue: repos.groups },
      { provide: MEMBERS, useValue: repos.members },
    ];
    return { module: DataModule, global: true, providers, exports: providers };
  }
}
