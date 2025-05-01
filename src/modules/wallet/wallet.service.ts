import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Wallet } from './wallet.entity';
import { Address } from '@src/types/types';
import { CreateWalletParams } from './types';

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

  async findByAddress(address: Address): Promise<Wallet | null> {
    return this.walletRepository.findOne({ where: { address } });
  }
}
