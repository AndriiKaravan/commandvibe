import { DynamicModule, Module, Provider } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { FirestorePushTokenStore, InMemoryPushTokenStore, PushMessaging, PushTokenStore } from '../shared/push';
import { FakePushMessaging } from '../shared/push/testing';
import { firestoreDatabaseId } from '../data/firestore-database';

export const PUSH_TOKEN_STORE = Symbol('PUSH_TOKEN_STORE');
export const PUSH_MESSAGING = Symbol('PUSH_MESSAGING');

export function pushProviders(storage: 'memory' | 'firestore'): Provider[] {
  if (storage === 'memory') {
    return [
      { provide: PUSH_TOKEN_STORE, useValue: new InMemoryPushTokenStore() },
      { provide: PUSH_MESSAGING, useValue: new FakePushMessaging() },
    ];
  }
  const app = () => getApps()[0] ?? initializeApp();
  return [
    {
      provide: PUSH_TOKEN_STORE,
      useFactory: (): PushTokenStore =>
        new FirestorePushTokenStore(getFirestore(app(), firestoreDatabaseId(process.env))),
    },
    { provide: PUSH_MESSAGING, useFactory: (): PushMessaging => getMessaging(app()) },
  ];
}

/** Exposes the token store and messaging client to the rest of the server. */
@Module({})
export class PushProvidersModule {
  static forRoot(storage: 'memory' | 'firestore'): DynamicModule {
    const providers = pushProviders(storage);
    return { module: PushProvidersModule, global: true, providers, exports: providers };
  }
}
