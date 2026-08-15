import { validateApiEnvironment } from './validate-environment';

describe('validateApiEnvironment', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = {
      ...original,
      NODE_ENV: 'production', DATABASE_URL_APP: 'postgresql://app@db/app',
      WEB_APP_URL: 'https://app.example.com', WEB_CORS_ORIGIN: 'https://app.example.com',
      JWT_ACCESS_SECRET: 'a'.repeat(48), CUSTOMER_JWT_SECRET: 'b'.repeat(48),
      STORAGE_ACCESS_KEY: 'production-access-key', STORAGE_SECRET_KEY: 'c'.repeat(48),
      TOTP_ENCRYPTION_KEY: 'ab'.repeat(32),
    };
  });

  afterAll(() => { process.env = original; });

  it('accepts a complete production configuration', () => {
    expect(() => validateApiEnvironment()).not.toThrow();
  });

  it('rejects development JWT secrets', () => {
    process.env.JWT_ACCESS_SECRET = 'dev-access-secret-change-me';
    expect(() => validateApiEnvironment()).toThrow('JWT_ACCESS_SECRET');
  });

  it('rejects malformed TOTP encryption keys', () => {
    process.env.TOTP_ENCRYPTION_KEY = 'z'.repeat(64);
    expect(() => validateApiEnvironment()).toThrow('64 hexadecimal');
  });

  it('does not require production credentials in development', () => {
    process.env = { NODE_ENV: 'development' };
    expect(() => validateApiEnvironment()).not.toThrow();
  });
});
