import * as crypto from 'crypto';
import { HttpStatus } from '@nestjs/common';

import { BotError } from '@libs/core/errors';
import { ENCRYPT_ALGORITHM, ENCRYPTED_IV_LENGTH, ENCRYPTED_KEY_LENGTH } from '@src/constants';

type Hex = `0x${string}`;

const encryptPrivateKey = ({ privateKey, encryptKey }: { privateKey: string; encryptKey: string }): string => {
  const key = Buffer.from(encryptKey, 'hex');
  const iv = crypto.randomBytes(ENCRYPTED_IV_LENGTH);

  if (key.length !== ENCRYPTED_KEY_LENGTH) {
    throw new BotError(
      'Invalid key length. Key must be 32 bytes (256 bits) in hex format',
      'Ошибка получения ключа',
      HttpStatus.BAD_REQUEST,
    );
  }

  const cipher = crypto.createCipheriv(ENCRYPT_ALGORITHM, key, iv);
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
    throw new BotError('Invalid encrypted string format', 'Ошибка получения ключа', HttpStatus.BAD_REQUEST);
  }

  const key = Buffer.from(encryptKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (key.length !== ENCRYPTED_KEY_LENGTH) {
    throw new BotError(
      'Invalid key length. Key must be 32 bytes (256 bits) in hex format',
      'Ошибка получения ключа',
      HttpStatus.BAD_REQUEST,
    );
  }

  const decipher = crypto.createDecipheriv(ENCRYPT_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted as Hex;
};

export { encryptPrivateKey, decryptPrivateKey };
