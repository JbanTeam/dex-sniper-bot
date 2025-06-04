import { Repository } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Wallet } from './wallet.entity';
import { Address } from '@src/types/types';
import { CreateWalletParams } from './types';
import { RedisService } from '@modules/redis/redis.service';
import { BotError } from '@src/errors/BotError';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly redisService: RedisService,
  ) {}

  async createWallet({
    network,
    encryptedPrivateKey,
    address,
    userId,
    entityManager,
  }: CreateWalletParams): Promise<Wallet> {
    const manager = entityManager || this.walletRepository.manager;
    const wallet = manager.create(Wallet, {
      network,
      encryptedPrivateKey,
      address,
      user: { id: userId },
    });

    return manager.save(wallet);
  }

  async getWallets(chatId: number): Promise<string> {
    const userSession = await this.redisService.getUser(chatId);

    if (!userSession.wallets.length) {
      throw new BotError('You have no wallets', 'У вас нет кошельков', HttpStatus.NOT_FOUND);
    }

    let reply = `<u>Ваши кошельки:</u>\n`;

    userSession.wallets.forEach((wallet, index) => {
      reply += `${index + 1}. <b>${wallet.network}:</b>\n<code>${wallet.address}</code>\n`;
    });

    return reply;
  }

  async findByAddress(address: Address): Promise<Wallet | null> {
    return this.walletRepository.findOne({ where: { address } });
  }
}
