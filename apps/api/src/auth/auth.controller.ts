import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import {
  registerProfileSchema,
  saveWeightsSchema,
  type RegisterProfileRequest,
  type SaveWeightsRequest,
} from './schemas';
import { type AuthenticatedRequest, VerifyTokenGuard } from './verify-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Put('profile/weights')
  @UseGuards(VerifyTokenGuard)
  async saveWeights(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(saveWeightsSchema)) body: SaveWeightsRequest,
  ) {
    await this.authService.saveWeights(request.uid, body.weights);
    return { weights: body.weights };
  }
}
