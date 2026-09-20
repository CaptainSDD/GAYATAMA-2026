import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { emailNotVerified } from '../common/errors';
import type { AuthenticatedRequest } from './verify-token.guard';
import { VerificationService } from './verification.service';

/**
 * Refuses a request from an account whose email address has never been
 * confirmed. Opt-in per route, and it must be listed *after* VerifyTokenGuard,
 * which is what puts `uid` and the claim on the request.
 *
 * Deliberately not folded into VerifyTokenGuard: sign-up calls
 * POST /auth/register-profile seconds after the account is created, long before
 * anyone could have opened their inbox, so verification cannot be a condition
 * of simply being authenticated.
 */
@Injectable()
export class RequireVerifiedEmailGuard implements CanActivate {
  constructor(private readonly verification: VerificationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Falls through to a live lookup when the claim says no, so someone who has
    // just followed the link is not locked out until their token happens to
    // refresh — an hour of being told to verify what they have already verified.
    if (await this.verification.isVerified(request.uid, request.emailVerified)) return true;
    throw emailNotVerified();
  }
}
