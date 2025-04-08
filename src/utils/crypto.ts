import { Hex } from 'viem';
import * as crypto from 'crypto';
import { BotError } from '@src/errors/BotError';

const encryptPrivateKey = ({ privateKey, encryptKey }: { privateKey: string; encryptKey: string }): string => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(encryptKey, 'hex');
  const iv = crypto.randomBytes(16);

  if (key.length !== 32) {
    throw new BotError(
      'Invalid key length. Key must be 32 bytes (256 bits) in hex format',
      'Ошибка получения ключа',
      400,
    );
  }

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
};

const decryptPrivateKey = ({
  encryptedPrivateKey,
  encryptKey,
}: {
  encryptedPrivateKey: string;
  encryptKey: string;
}): Hex => {
  const [ivHex, encryptedHex] = encryptedPrivateKey.split(':');

  if (!ivHex || !encryptedHex) {
    throw new BotError('Invalid encrypted string format', 'Ошибка получения ключа', 400);
  }

  const key = Buffer.from(encryptKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');

  if (key.length !== 32) {
    throw new BotError(
      'Invalid key length. Key must be 32 bytes (256 bits) in hex format',
      'Ошибка получения ключа',
      400,
    );
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted as Hex;
};

export { encryptPrivateKey, decryptPrivateKey };
