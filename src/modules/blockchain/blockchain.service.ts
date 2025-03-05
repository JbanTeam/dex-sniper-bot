import { Injectable } from '@nestjs/common';

import { ViemProvider } from './viem/viem.provider';
import { Wallet } from '@modules/wallet/wallet.entity';
import { WalletService } from '@modules/wallet/wallet.service';
import { Network } from '@src/types/types';
import { EntityManager } from 'typeorm';

@Injectable()
export class BlockchainService {
  constructor(
    private readonly viemProvider: ViemProvider,
    private readonly walletService: WalletService,
  ) {}

  async createWallet({
    userId,
    network,
    entityManager,
  }: {
    userId: number;
    network: Network;
    entityManager?: EntityManager;
  }): Promise<Wallet> {
    const wallet = await this.viemProvider.createWallet(network);
    const savedWallet = await this.walletService.createWallet({
      ...wallet,
      userId,
      entityManager,
    });
    return savedWallet;
  }

  // async getBalance(address: string, network: Network): Promise<string> {
  //   return this.viemProvider.getBalance(address, network);
  // }

  // async monitorAddress(address: string, network: Network): Promise<void> {
  //   return this.viemProvider.monitorAddress(address, network);
  // }
}
