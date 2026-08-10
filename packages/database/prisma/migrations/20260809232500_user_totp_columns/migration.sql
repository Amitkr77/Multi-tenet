-- Add TOTP columns to users table for 2FA support.
-- `two_factor_pending_secret` stores the secret during setup (before verification).
-- `two_factor_secret` stores the verified secret once 2FA is enabled.
-- Both are AES-256-GCM encrypted at the application layer before storage.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_pending_secret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT;
