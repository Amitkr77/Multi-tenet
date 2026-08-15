const DEVELOPMENT_SECRET_VALUES = new Set([
  'dev-access-secret-change-me',
  'dev-customer-secret-change-me',
  'whsec_dev_placeholder_change_me',
  'minioadmin',
]);

function requireValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required production environment variable: ${name}`);
  return value;
}

function requireSecret(name: string, minimumLength = 32): void {
  const value = requireValue(name);
  if (value.length < minimumLength || DEVELOPMENT_SECRET_VALUES.has(value)) {
    throw new Error(`${name} must be a non-development secret of at least ${minimumLength} characters.`);
  }
}

/** Fail closed before Nest starts if production would use local-development credentials. */
export function validateApiEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;

  requireValue('DATABASE_URL_APP');
  requireValue('WEB_APP_URL');
  requireValue('WEB_CORS_ORIGIN');
  requireSecret('JWT_ACCESS_SECRET');
  requireSecret('CUSTOMER_JWT_SECRET');
  requireSecret('STORAGE_ACCESS_KEY', 16);
  requireSecret('STORAGE_SECRET_KEY');

  const totpKey = requireValue('TOTP_ENCRYPTION_KEY');
  if (!/^[0-9a-fA-F]{64}$/.test(totpKey)) {
    throw new Error('TOTP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).');
  }

  if (process.env.STRIPE_SECRET_KEY) requireSecret('STRIPE_WEBHOOK_SECRET');
}
