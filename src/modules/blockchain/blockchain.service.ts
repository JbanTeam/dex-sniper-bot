import { Address } from 'viem';
import { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ViemProvider } from './viem/viem.provider';
import { AnvilProvider } from './viem/anvil/anvil.provider';
import { Wallet } from '@modules/wallet/wallet.entity';
import { WalletService } from '@modules/wallet/wallet.service';
import { RedisService } from '@modules/redis/redis.service';
import { Network, SessionUserToken, SessionWallet } from '@src/types/types';

@Injectable()
export class BlockchainService {
  constructor(
    private readonly viemProvider: ViemProvider,
    private readonly anvilProvider: AnvilProvider,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
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

  async checkToken({
    address,
    network,
  }: {
    address: Address;
    network: Network;
  }): Promise<{ name: string; symbol: string; decimals: number }> {
    return this.viemProvider.checkToken({ address, network });
  }

  async getBalance({
    chatId,
    address,
    network,
  }: {
    chatId: number;
    address: Address;
    network: Network;
  }): Promise<string> {
    return this.viemProvider.getBalance({ address, network, chatId });
  }

  async stopMonitoring() {
    await this.viemProvider.stopMonitoring();
  }

  async setTestBalance({
    chatId,
    network,
    address,
  }: {
    chatId: number;
    network: Network;
    address: Address;
  }): Promise<string> {
    await this.anvilProvider.setTestBalance({ network, address });

    return this.viemProvider.getBalance({ address, network, chatId });
  }

  async deployTestContract({ wallet, token }: { wallet: SessionWallet; token: SessionUserToken }) {
    return this.anvilProvider.deployTestContract({
      walletAddress: wallet.address,
      token,
    });
  }

  async sendFakeTransaction(contractAddress: Address) {
    return this.anvilProvider.sendFakeTransaction(contractAddress);
  }
}
