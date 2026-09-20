import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { RequireVerifiedEmailGuard } from './require-verified-email.guard';
import {
  registerProfileSchema,
  saveWeightsSchema,
  type RegisterProfileRequest,
  type SaveWeightsRequest,
} from './schemas';
import { VerificationService } from './verification.service';
import { type AuthenticatedRequest, VerifyTokenGuard } from './verify-token.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verification: VerificationService,
  ) {}

  @Post('register-profile')
  @UseGuards(VerifyTokenGuard)
  async registerProfile(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(registerProfileSchema)) body: RegisterProfileRequest,
  ) {
    const profile = await this.authService.registerProfile(request.uid, request.email, body);
    return { username: profile.username };
  }

  @Get('profile')
  @UseGuards(VerifyTokenGuard)
  async profile(@Req() request: AuthenticatedRequest) {
    const profile = await this.authService.getProfile(request.uid, request.email);
    if (profile === null) return { profile: null };
    return {
      profile: {
        username: profile.username,
        email: profile.email,
        createdAt: profile.createdAt,
        weights: profile.weights,
      },
    };
  }

  /**
   * The one place verification is currently enforced. Writing a weight set to
   * an account is the only request that both belongs to an identity and is not
   * part of creating one — `register-profile` cannot require verification
   * (sign-up calls it before anyone has opened their inbox) and reading a
   * profile has nothing to protect. Add the second guard to any future route
   * that should need a confirmed address.
   */
  @Put('profile/weights')
  @UseGuards(VerifyTokenGuard, RequireVerifiedEmailGuard)
  async saveWeights(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(saveWeightsSchema)) body: SaveWeightsRequest,
  ) {
    await this.authService.saveWeights(request.uid, body.weights);
    return { weights: body.weights };
  }

  /** Live state from Firebase, so it is right the moment the link is followed. */
  @Get('verification-status')
  @UseGuards(VerifyTokenGuard)
  async verificationStatus(@Req() request: AuthenticatedRequest) {
    return this.verification.status(request.uid);
  }

  /**
   * Throttled well below the global 60/minute: this is the one endpoint that
   * puts mail in someone else's inbox, and the address is chosen by whoever
   * registered. Five in ten minutes covers a genuine retry after a typo or a
   * slow relay and is useless for flooding a mailbox.
   *
   * The throttler counts per IP, not per account, so everyone behind one NAT
   * shares this budget. That is the conservative direction to err in for a send
   * endpoint, but it is why the limit is not tighter.
   */
  @Post('verification-email')
  @UseGuards(VerifyTokenGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async sendVerificationEmail(@Req() request: AuthenticatedRequest) {
    return this.verification.send(request.uid);
  }
}
