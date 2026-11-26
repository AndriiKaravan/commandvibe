import { Injectable, UnauthorizedException } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  name?: string;
  /** `google.com`, `password` (email link) and so on. */
  provider: string;
}

/** Firebase Admin access; the only place the server talks to Firebase Auth. */
@Injectable()
export class FirebaseService {
  async verifyIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
    const app = getApps()[0] ?? initializeApp();
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
        provider: decoded.firebase.sign_in_provider,
      };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
