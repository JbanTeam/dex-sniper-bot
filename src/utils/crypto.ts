import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

const encryptPrivateKey = ({
  privateKey,
  configService,
}: {
  privateKey: string;
  configService: ConfigService;
}): string => {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(configService.get<string>('ENCRYPT_KEY', 'super_secret_key'), 'hex');
  const iv = crypto.randomBytes(16);

  if (key.length !== 32) {
    throw new Error('Invalid key length. Key must be 32 bytes (256 bits) in hex format.');
  }

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
};

const decryptPrivateKey = ({
  encryptedPrivateKey,
  configService,
}: {
  encryptedPrivateKey: string;
  configService: ConfigService;
}): string => {
  const [ivHex, encryptedHex] = encryptedPrivateKey.split(':');

  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted string format');
  }

  const key = Buffer.from(configService.get<string>('ENCRYPT_KEY', 'super_secret_key'), 'hex');
  const iv = Buffer.from(ivHex, 'hex');

  if (key.length !== 32) {
    throw new Error('Invalid key length. Key must be 32 bytes (256 bits) in hex format.');
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

export { encryptPrivateKey, decryptPrivateKey };
