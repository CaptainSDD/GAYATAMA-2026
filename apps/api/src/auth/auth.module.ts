import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RequireVerifiedEmailGuard } from './require-verified-email.guard';
import { VerificationService } from './verification.service';
import { VerifyTokenGuard } from './verify-token.guard';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService, VerificationService, VerifyTokenGuard, RequireVerifiedEmailGuard],
  // `AuthService` and `VerifyTokenGuard` are reused outside this module: every
  // analysis/location route now requires sign-in, and the premium kecamatan
  // check needs to read the caller's plan.
  exports: [AuthService, VerifyTokenGuard],
})
export class AuthModule {}
