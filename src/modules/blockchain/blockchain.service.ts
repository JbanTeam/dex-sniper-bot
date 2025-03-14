import { Address } from 'viem';
import { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ViemProvider } from './viem/viem.provider';
import { Wallet } from '@modules/wallet/wallet.entity';
import { WalletService } from '@modules/wallet/wallet.service';
import { AnvilProvider } from './viem/anvil/anvil.provider';
import { RedisService } from '@modules/redis/redis.service';
import { Network, UserTestToken } from '@src/types/types';
import { CreateTestTokensParams, DeployTestContractParams, SaveTestTokensParams } from './viem/types';

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

  async setTestBalance({
    chatId,
    network,
    address,
  }: {
    chatId: number;
    network: Network;
    address: Address;
  }): Promise<string> {
    await this.viemProvider.setTestBalance({ network, address });

    return this.viemProvider.getBalance({ address, network, chatId });
  }

  async deployTestContract(testContractParams: DeployTestContractParams): Promise<UserTestToken> {
    return this.anvilProvider.deployTestContract(testContractParams);
  }

  async createTestTokens({ wallets, tokens, chatId }: CreateTestTokensParams): Promise<UserTestToken[] | undefined> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv === 'production') return;

    const userSession = chatId ? await this.redisService.getSessionData(chatId.toString()) : undefined;

    const userTestTokens = await Promise.all(
      tokens.map(async token => {
        return await this.createTestToken({
          wallets: wallets,
          network: token.network,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
        });
      }),
    );

    if (userSession?.testTokens?.length) {
      return [...userSession.testTokens, ...userTestTokens];
    }

    return userTestTokens;
  }

  private async createTestToken(saveParams: SaveTestTokensParams): Promise<UserTestToken> {
    const { wallets, network, name, symbol, decimals } = saveParams;

    const wallet = wallets.find(wallet => wallet.network === network);
    if (!wallet) throw new Error('Кошелек не найден');
    const walletAddress = wallet.address as Address;

    return this.deployTestContract({
      walletAddress,
      name,
      symbol,
      decimals,
      network,
    });
  }

  // async monitorAddress(address: string, network: Network): Promise<void> {
  //   return this.viemProvider.monitorAddress(address, network);
  // }
}
