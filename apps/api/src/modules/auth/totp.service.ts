import { Injectable } from '@nestjs/common';
import {
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';

// ---------------------------------------------------------------------------
// Pure RFC 6238 TOTP — no external library so we add zero new deps.
// ---------------------------------------------------------------------------

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_CHARS[(value << (5 - bits)) & 0x1f];
  return result;
}

function base32Decode(encoded: string): Buffer {
  const chars = encoded.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const result: number[] = [];
  for (const ch of chars) {
    const idx = BASE32_CHARS.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(result);
}

function hotp(secret: Buffer, counter: bigint, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

/** Generate a TOTP token for the current time window. */
function generateTotp(base32Secret: string, stepSeconds = 30, digits = 6): string {
  const counter = BigInt(Math.floor(Date.now() / 1000 / stepSeconds));
  return hotp(base32Decode(base32Secret), counter, digits);
}

/**
 * Verify a TOTP token, accepting ±`windowSteps` time steps to account for
 * clock skew. Returns true if the token matches any acceptable window.
 */
function verifyTotp(
  base32Secret: string,
  token: string,
  windowSteps = 1,
  stepSeconds = 30,
  digits = 6,
): boolean {
  const base = BigInt(Math.floor(Date.now() / 1000 / stepSeconds));
  const secretBuf = base32Decode(base32Secret);
  for (let i = -windowSteps; i <= windowSteps; i++) {
    if (hotp(secretBuf, base + BigInt(i), digits) === token) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// AES-256-GCM symmetric encryption for storing TOTP secrets at rest.
// ---------------------------------------------------------------------------

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getEncKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY ?? '';
  if (raw.length < KEY_BYTES) {
    // Deterministic fallback for local dev — NOT safe for production.
    return Buffer.alloc(KEY_BYTES, 'dev-totp-key-change-me', 'utf8');
  }
  return Buffer.from(raw.slice(0, KEY_BYTES * 2), 'hex');
}

function encrypt(plaintext: string): string {
  const key = getEncKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: hex(iv):hex(tag):hex(ciphertext)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(stored: string): string {
  const key = getEncKey();
  const [ivHex, tagHex, ctHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// Injectable service
// ---------------------------------------------------------------------------

@Injectable()
export class TotpService {
  /** Generate a new 20-byte random base32 TOTP secret and its otpauth URI. */
  generateSecret(email: string, issuer = 'SaaS Platform'): {
    base32: string;
    otpauthUrl: string;
    encryptedSecret: string;
  } {
    const base32 = base32Encode(randomBytes(20));
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${base32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
    return { base32, otpauthUrl, encryptedSecret: encrypt(base32) };
  }

  /** Verify a user-submitted TOTP code against the stored (encrypted) secret. */
  verify(encryptedSecret: string, token: string): boolean {
    try {
      const base32 = decrypt(encryptedSecret);
      return verifyTotp(base32, token.replace(/\s/g, ''));
    } catch {
      return false;
    }
  }

  /** Encrypt a raw base32 secret for storage. */
  encrypt(base32: string): string {
    return encrypt(base32);
  }

  /** Decrypt a stored secret — only needed for internal re-encrypt scenarios. */
  decryptForMigration(stored: string): string {
    return decrypt(stored);
  }
}
