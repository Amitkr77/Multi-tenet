import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtCustomerPayload } from '../customer-jwt-payload.interface';
import type { AuthenticatedCustomer } from '../../../common/decorators/current-customer.decorator';

/**
 * Named "customer-jwt" (distinct from staff's "jwt" strategy) and signed
 * with a completely separate secret (CUSTOMER_JWT_SECRET vs
 * JWT_ACCESS_SECRET) — a leaked customer token can never be replayed as a
 * staff token or vice versa, even if someone accidentally wired the wrong
 * guard onto a route.
 */
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  'customer-jwt',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.CUSTOMER_JWT_SECRET ?? 'dev-customer-secret-change-me',
    });
  }

  validate(payload: JwtCustomerPayload): AuthenticatedCustomer {
    return {
      customerId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
    };
  }
}
