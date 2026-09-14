import { type CanActivate, type ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Auth } from 'firebase-admin/auth';
import { ApiError, unauthorized } from '../common/errors';
import { FIREBASE_AUTH } from '../firebase/firebase.module';

export interface AuthenticatedRequest extends Request {
  /** Set once the ID token has been verified against Firebase Auth itself. */
  uid: string;
  email: string | null;
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Verifies the `Authorization: Bearer <idToken>` header against Firebase Auth
 * before trusting anything else in the request. The token proves who is
 * calling; nothing in the request body is trusted to say so itself.
 */
@Injectable()
export class VerifyTokenGuard implements CanActivate {
  constructor(@Inject(FIREBASE_AUTH) private readonly auth: Auth | null) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.auth === null) {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'REQUEST_FAILED',
        'Firebase Authentication is not configured on the server.',
      );
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
    if (token === undefined || token === '') throw unauthorized('Missing Authorization header.');

    try {
      const decoded = await this.auth.verifyIdToken(token);
      request.uid = decoded.uid;
      request.email = decoded.email ?? null;
      return true;
    } catch {
      throw unauthorized('Invalid or expired ID token.');
    }
  }
}
