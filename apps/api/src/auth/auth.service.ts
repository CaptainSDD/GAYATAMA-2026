import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { ApiError, usernameTaken } from '../common/errors';
import { FIRESTORE } from '../firebase/firebase.module';
import type { RegisterProfileRequest } from './schemas';

export interface UserProfile {
  uid: string;
  email: string | null;
  username: string;
  createdAt: string;
}

/**
 * Firebase Auth has no concept of a username at all, so uniqueness is
 * enforced here: a `usernames/{lowercased}` reservation document, created
 * only if it doesn't already exist. Firestore Security Rules deny every
 * client path to `users/` and `usernames/` — this, via the Admin SDK, is the
 * only way either collection is ever written.
 */
@Injectable()
export class AuthService {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore | null) {}

  async registerProfile(uid: string, email: string | null, request: RegisterProfileRequest): Promise<UserProfile> {
    if (this.firestore === null) {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'REQUEST_FAILED',
        'Firestore is not configured on the server, so a profile cannot be saved.',
      );
    }
    const firestore = this.firestore;

    const usernameKey = request.username.toLowerCase();
    const usernameRef = firestore.collection('usernames').doc(usernameKey);
    const userRef = firestore.collection('users').doc(uid);
    const createdAt = new Date().toISOString();

    await firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(usernameRef);
      if (existing.exists) {
        // Same user retrying after a response was lost post-commit (dropped
        // connection, timeout) — the write already succeeded, so this is a
        // no-op, not a conflict. Only a genuinely different owner is taken.
        if (existing.data()?.uid === uid) return;
        throw usernameTaken(request.username);
      }
      transaction.set(usernameRef, { uid });
      transaction.set(userRef, { email, username: request.username, createdAt });
    });

    return { uid, email, username: request.username, createdAt };
  }
}
