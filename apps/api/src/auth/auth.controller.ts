import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { registerProfileSchema, type RegisterProfileRequest } from './schemas';
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
}
