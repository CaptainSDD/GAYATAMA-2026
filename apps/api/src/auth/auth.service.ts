import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { ApiError, usernameTaken } from '../common/errors';
import { FIRESTORE } from '../firebase/firebase.module';
import type { ComponentWeightsRequest, RegisterProfileRequest } from './schemas';

export type Plan = 'free' | 'premium';

export interface UserProfile {
  uid: string;
  email: string | null;
  username: string;
  createdAt: string;
  /** null when the visitor has never left the documented baseline. */
  weights: ComponentWeightsRequest | null;
  /** No payment behind this — see `setPlan`. Defaults to `'free'` at sign-up. */
  plan: Plan;
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
      transaction.set(userRef, { email, username: request.username, createdAt, plan: 'free' });
    });

    return { uid, email, username: request.username, createdAt, weights: null, plan: 'free' };
  }

  /**
   * Reads the profile the client cannot: Firestore rules deny every client
   * path to `users/`, so this Admin SDK read is the only way the app ever
   * learns its own username or saved weights.
   */
  async getProfile(uid: string, email: string | null): Promise<UserProfile | null> {
    const firestore = this.requireFirestore();
    const snapshot = await firestore.collection('users').doc(uid).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() ?? {};
    return {
      uid,
      email: (data.email as string | null | undefined) ?? email,
      username: (data.username as string | undefined) ?? '',
      createdAt: (data.createdAt as string | undefined) ?? '',
      weights: (data.weights as ComponentWeightsRequest | undefined) ?? null,
      // Accounts created before `plan` existed have no such field: default free.
      plan: (data.plan as Plan | undefined) ?? 'free',
    };
  }

  /** Passing null clears the saved set, returning the visitor to the baseline. */
  async saveWeights(uid: string, weights: ComponentWeightsRequest | null): Promise<void> {
    const firestore = this.requireFirestore();
    const userRef = firestore.collection('users').doc(uid);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'REQUEST_FAILED',
        'No profile exists for this account yet.',
      );
    }
    await userRef.set({ weights }, { merge: true });
  }

  /**
   * The whole "upgrade" flow: no payment behind it, just an authenticated
   * write to the caller's own account — the demo toggle button server-side.
   */
  async setPlan(uid: string, plan: Plan): Promise<void> {
    const firestore = this.requireFirestore();
    const userRef = firestore.collection('users').doc(uid);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'REQUEST_FAILED',
        'No profile exists for this account yet.',
      );
    }
    await userRef.set({ plan }, { merge: true });
  }

  private requireFirestore(): Firestore {
    if (this.firestore === null) {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'REQUEST_FAILED',
        'Firestore is not configured on the server, so a profile cannot be read or saved.',
      );
    }
    return this.firestore;
  }
}
