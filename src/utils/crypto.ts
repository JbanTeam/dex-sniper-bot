import * as crypto from 'crypto';
import { BotError } from '@src/errors/BotError';

type Hex = `0x${string}`;

const encryptPrivateKey = ({ privateKey, encryptKey }: { privateKey: string; encryptKey: string }): string => {
  const key = Buffer.from(encryptKey, 'hex');
  const iv = crypto.randomBytes(12); // Recommended 12-byte IV for GCM

  if (key.length !== 32) {
    throw new BotError(
      'Invalid key length. Key must be 32 bytes (256 bits) in hex format',
      'Ошибка получения ключа',
      400,
    );
  }

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
};

const decryptPrivateKey = ({
  encryptedPrivateKey,
  encryptKey,
}: {
  encryptedPrivateKey: string;
  encryptKey: string;
}): Hex => {
  const [ivHex, encryptedHex, authTagHex] = encryptedPrivateKey.split(':');

  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new BotError('Invalid encrypted string format', 'Ошибка получения ключа', 400);
  }

  const key = Buffer.from(encryptKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (key.length !== 32) {
    throw new BotError(
      'Invalid key length. Key must be 32 bytes (256 bits) in hex format',
      'Ошибка получения ключа',
      400,
    );
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted as Hex;
};

export { encryptPrivateKey, decryptPrivateKey };
