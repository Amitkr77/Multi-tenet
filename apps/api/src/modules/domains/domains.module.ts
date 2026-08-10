import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { DnsVerificationService } from './dns-verification.service';
import { AcmService } from './acm.service';

@Module({
  controllers: [DomainsController],
  providers: [DomainsService, DnsVerificationService, AcmService],
  exports: [DomainsService],
})
export class DomainsModule {}
