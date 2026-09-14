import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { VerifyTokenGuard } from './verify-token.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, VerifyTokenGuard],
})
export class AuthModule {}
