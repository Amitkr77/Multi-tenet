import { TotpService } from './totp.service';

describe('TotpService encryption', () => {
  const original = process.env;
  const service = new TotpService();

  afterEach(() => {
    process.env = { ...original };
  });

  afterAll(() => {
    process.env = original;
  });

  it('round-trips a secret with a valid 32-byte hex key', () => {
    process.env.TOTP_ENCRYPTION_KEY = 'ab'.repeat(32);
    const encrypted = service.encrypt('JBSWY3DPEHPK3PXP');
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(service.decryptForMigration(encrypted)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('fails closed on a malformed production key', () => {
    process.env.NODE_ENV = 'production';
    process.env.TOTP_ENCRYPTION_KEY = 'not-a-hex-key';
    expect(() => service.encrypt('JBSWY3DPEHPK3PXP')).toThrow(
      '64 hexadecimal characters',
    );
  });
});
