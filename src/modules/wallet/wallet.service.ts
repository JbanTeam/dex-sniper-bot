import { EntityManager, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Wallet } from './wallet.entity';
import { Network } from '@src/types/types';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  async createWallet({
    network,
    encryptedPrivateKey,
    address,
    userId,
    entityManager,
  }: {
    network: Network;
    encryptedPrivateKey: string;
    address: string;
    userId: number;
    entityManager?: EntityManager;
  }): Promise<Wallet> {
    const manager = entityManager || this.walletRepository.manager;
    const wallet = manager.create(Wallet, {
      network,
      encryptedPrivateKey,
      address,
      user: { id: userId },
    });

    return manager.save(wallet);
  }
}
