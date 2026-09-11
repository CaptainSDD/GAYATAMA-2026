import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import type { Env } from '../config/env';

export const FIRESTORE = Symbol('FIRESTORE');

const APP_NAME = 'gayatama-api';

/**
 * Provides Firestore, or `null` when Firebase is not configured. Caching is an
 * optimisation, not a dependency: without Firestore the API runs on an
 * in-memory cache.
 */
export function createFirestore(config: ConfigService<Env, true>): Firestore | null {
  const logger = new Logger('Firebase');
  const projectId = config.get('FIREBASE_PROJECT_ID', { infer: true });
  const serviceAccountJson = config.get('FIREBASE_SERVICE_ACCOUNT_JSON', { infer: true });

  if (projectId === undefined && serviceAccountJson === undefined) {
    logger.warn('Firebase is not configured: POI cache is in-memory only.');
    return null;
  }

  let credential;
  try {
    credential = serviceAccountJson === undefined ? applicationDefault() : cert(JSON.parse(serviceAccountJson));
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid service account JSON.');
  }

  const app =
    getApps().find((existing) => existing.name === APP_NAME) ??
    initializeApp({ credential, ...(projectId === undefined ? {} : { projectId }) }, APP_NAME);
  return getFirestore(app);
}

@Global()
@Module({
  providers: [{ provide: FIRESTORE, inject: [ConfigService], useFactory: createFirestore }],
  exports: [FIRESTORE],
})
export class FirebaseModule {}
