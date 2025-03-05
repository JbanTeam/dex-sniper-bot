import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWalletClient, http } from 'viem';
import { polygon, bsc } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Network } from '@src/types/types';

@Injectable()
export class ViemProvider {
  private clients = {
    [Network.BSC]: createWalletClient({
      chain: bsc,
      transport: http(process.env.BSC_RPC_URL),
    }),
    [Network.POLYGON]: createWalletClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL),
    }),
  };

  constructor(private readonly configService: ConfigService) {}

  async createWallet(network: Network) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    return {
      network,
      encryptedPrivateKey: this.encryptPrivateKey(privateKey),
      address: account.address,
    };
  }

  private encryptPrivateKey(privateKey: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(this.configService.get<string>('ENCRYPT_KEY', 'super_secret_key'), 'hex');
    const iv = crypto.randomBytes(16);

    if (key.length !== 32) {
      throw new Error('Invalid key length. Key must be 32 bytes (256 bits) in hex format.');
    }

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptPrivateKey(encryptedPrivateKey: string): string {
    const [ivHex, encryptedHex] = encryptedPrivateKey.split(':');

    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted string format');
    }

    const key = Buffer.from(this.configService.get<string>('ENCRYPT_KEY', 'super_secret_key'), 'hex');
    const iv = Buffer.from(ivHex, 'hex');

    if (key.length !== 32) {
      throw new Error('Invalid key length. Key must be 32 bytes (256 bits) in hex format.');
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // async getBalance(address: string, network: Network): Promise<string> {
  //   const balance = await this.clients[network].getBalance({ address });
  //   return parseEther(balance.toString());
  // }
}
