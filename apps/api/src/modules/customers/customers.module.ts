import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomersController } from './customers.controller';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerSessionsService } from './customer-sessions.service';
import { CustomerAddressesService } from './customer-addresses.service';
import { CustomersService } from './customers.service';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    // Options are always overridden per-call in CustomerAuthService (a
    // distinct secret/expiry from staff's JwtModule registration in
    // AuthModule) — registered here only so JwtService is injectable at all.
    JwtModule.register({}),
  ],
  // Order matters: CustomerAuthController's literal paths (register/login/
  // refresh/logout/me) must be registered before CustomersController's
  // `:id` — see customers.controller.ts's comment.
  controllers: [CustomerAuthController, CustomersController],
  providers: [
    CustomerAuthService,
    CustomerSessionsService,
    CustomerAddressesService,
    CustomersService,
    CustomerJwtStrategy,
  ],
})
export class CustomersModule {}
