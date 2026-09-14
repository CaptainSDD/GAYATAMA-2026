import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type App, applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { type Auth, getAuth } from 'firebase-admin/auth';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import type { Env } from '../config/env';

export const FIREBASE_APP = Symbol('FIREBASE_APP');
export const FIRESTORE = Symbol('FIRESTORE');
export const FIREBASE_AUTH = Symbol('FIREBASE_AUTH');

const APP_NAME = 'gayatama-api';

/**
 * The Firebase app shared by Firestore and Authentication, or `null` when
 * Firebase is not configured. Caching and sign-up are optimisations/features
 * layered on top; the API still runs without them.
 */
export function createFirebaseApp(config: ConfigService<Env, true>): App | null {
  const logger = new Logger('Firebase');
  const projectId = config.get('FIREBASE_PROJECT_ID', { infer: true });
  const serviceAccountJson = config.get('FIREBASE_SERVICE_ACCOUNT_JSON', { infer: true });

  if (projectId === undefined && serviceAccountJson === undefined) {
    logger.warn('Firebase is not configured: POI cache is in-memory only, and sign-up cannot be completed.');
    return null;
  }

  let credential;
  try {
    credential = serviceAccountJson === undefined ? applicationDefault() : cert(JSON.parse(serviceAccountJson));
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid service account JSON.');
  }

  return (
    getApps().find((existing) => existing.name === APP_NAME) ??
    initializeApp({ credential, ...(projectId === undefined ? {} : { projectId }) }, APP_NAME)
  );
}

export function createFirestore(app: App | null): Firestore | null {
  return app === null ? null : getFirestore(app);
}

export function createFirebaseAuth(app: App | null): Auth | null {
  return app === null ? null : getAuth(app);
}

@Global()
@Module({
  providers: [
    { provide: FIREBASE_APP, inject: [ConfigService], useFactory: createFirebaseApp },
    { provide: FIRESTORE, inject: [FIREBASE_APP], useFactory: createFirestore },
    { provide: FIREBASE_AUTH, inject: [FIREBASE_APP], useFactory: createFirebaseAuth },
  ],
  exports: [FIRESTORE, FIREBASE_AUTH],
})
export class FirebaseModule {}
