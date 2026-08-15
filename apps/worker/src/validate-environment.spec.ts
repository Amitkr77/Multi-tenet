import { validateWorkerEnvironment } from './validate-environment';

describe('validateWorkerEnvironment', () => {
  const original = process.env;
  afterAll(() => { process.env = original; });

  it('rejects the documented development database password in production', () => {
    process.env = { NODE_ENV: 'production', DATABASE_URL_APP: 'postgresql://app_user:change_me_in_env@db/app', STORAGE_ACCESS_KEY: 'production-access', STORAGE_SECRET_KEY: 'production-secret', WEB_APP_URL: 'https://app.example.com' };
    expect(() => validateWorkerEnvironment()).toThrow('development credential');
  });

  it('allows development without production credentials', () => {
    process.env = { NODE_ENV: 'development' };
    expect(() => validateWorkerEnvironment()).not.toThrow();
  });
});
