import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedPayload {
    data: string;   // base64
    iv: string;     // base64
    tag: string;    // base64
}

/**
  * Derive KEK (Key Encryption Key) from master password using PBKDF2.
  * Same password + same salt = same KEK (deterministic).
  */
export function deriveKEK(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
  * Generate a random DEK (Data Encryption Key).
  * This key encrypts all vault data and is itself encrypted by the KEK.
  */
export function generateDEK(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
}

/**
  * Encrypt data using AES-256-GCM.
  */
export function encryptAES(key: Buffer, plaintext: string | Buffer): EncryptedPayload {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf-8') : plaintext;
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        data: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
    };
}

/**
  * Decrypt data using AES-256-GCM.
  * Throws if the key or data is wrong.
  */
export function decryptAES(key: Buffer, payload: EncryptedPayload): Buffer {
    const iv = Buffer.from(payload.iv, 'base64');
    const data = Buffer.from(payload.data, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
  * Generate a cryptographically secure random password.
  */
export function generatePassword(options: {
    length?: number;
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
} = {}): string {
    const {
        length: rawLength = 20,
        uppercase = true,
        lowercase = true,
        numbers = true,
        symbols = true,
    } = options;

    let length = rawLength;

    let chars = '';
    const required: string[] = [];

    if (uppercase) {
        chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        required.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
    if (lowercase) {
        chars += 'abcdefghijklmnopqrstuvwxyz';
        required.push('abcdefghijklmnopqrstuvwxyz');
    }
    if (numbers) {
        chars += '0123456789';
        required.push('0123456789');
    }
    if (symbols) {
        chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
        required.push('!@#$%^&*()_+-=[]{}|;:,.<>?');
    }

    if (chars.length === 0) {
        chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        required.push(chars);
    }

    // Validate length
    if (length < required.length) {
        length = required.length;
    }
    if (length < 1) length = 1;

    // Rejection sampling: avoid modulo bias
    function randomIndex(max: number): number {
        const limit = 256 - (256 % max);
        let buf: Buffer;
        do {
            buf = crypto.randomBytes(1);
        } while (buf[0] >= limit);
        return buf[0] % max;
    }

    // Build password using rejection sampling
    const pwArray: string[] = new Array(length).fill('');

    // Place one required char from each set at unique positions
    const usedPositions = new Set<number>();
    for (const set of required) {
        let pos: number;
        do {
            pos = randomIndex(length);
        } while (usedPositions.has(pos));
        usedPositions.add(pos);
        pwArray[pos] = set[randomIndex(set.length)];
    }

    // Fill remaining positions with random chars from full charset
    for (let i = 0; i < length; i++) {
        if (pwArray[i] === '') {
            pwArray[i] = chars[randomIndex(chars.length)];
        }
    }

    return pwArray.join('');
}

/**
  * Generate a random salt for PBKDF2.
  */
export function generateSalt(): Buffer {
    return crypto.randomBytes(SALT_LENGTH);
}
