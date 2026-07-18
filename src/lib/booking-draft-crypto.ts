import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// booking_drafts (NEX-052): the resume token is never stored — only its SHA-256 hash
// (same "don't store the secret itself" pattern as ADR for public booking tokens), and
// the payload is encrypted at rest (AES-256-GCM) so a raw DB read never exposes a
// client's name/phone/selection in plain text.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function generateResumeToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashResumeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getEncryptionKey(): Buffer {
  const key = process.env.BOOKING_DRAFT_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('BOOKING_DRAFT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(key, 'hex');
}

export function encryptDraftPayload(payload: unknown): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptDraftPayload<T>(encrypted: string): T {
  const raw = Buffer.from(encrypted, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
