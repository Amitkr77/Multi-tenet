import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@saas/shared-types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { TotpService } from './totp.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.email }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, TotpService, JwtStrategy],
  exports: [SessionsService],
})
export class AuthModule {}
