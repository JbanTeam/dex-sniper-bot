import { Injectable } from '@nestjs/common';

import { ViemProvider } from './viem/viem.provider';
import { AnvilProvider } from './viem/anvil/anvil.provider';
import { Wallet } from '@modules/wallet/wallet.entity';
import { WalletService } from '@modules/wallet/wallet.service';
import { CreateTestTokenReturnType } from './viem/types';
import { Network, NetworkProviders, SessionUserToken, TestNetworkProviders } from '@src/types/types';
import {
  CheckTokenParams,
  CheckTokenReturnType,
  CreateWalletParams,
  DeployTokenParams,
  GetBalanceParams,
  SendNativeParams,
  SendTokensParams,
} from './types';

@Injectable()
export class BlockchainService {
  private readonly networkProviders: NetworkProviders;
  private readonly testNetworkProviders: TestNetworkProviders;
  constructor(
    private readonly viemProvider: ViemProvider,
    private readonly anvilProvider: AnvilProvider,
    private readonly walletService: WalletService,
  ) {
    this.networkProviders = {
      [Network.BSC]: this.viemProvider,
      [Network.POLYGON]: this.viemProvider,
    };

    this.testNetworkProviders = {
      [Network.BSC]: this.anvilProvider,
      [Network.POLYGON]: this.anvilProvider,
    };
  }

  async createWallet({ userId, network, entityManager }: CreateWalletParams): Promise<Wallet> {
    const provider = this.networkProviders[network];
    const wallet = await provider.createWallet(network);

    const savedWallet = await this.walletService.createWallet({
      ...wallet,
      userId,
      entityManager,
    });

    return savedWallet;
  }

  async checkToken({ address, network }: CheckTokenParams): Promise<CheckTokenReturnType> {
    const provider = this.networkProviders[network];

    return provider.checkToken({ address, network });
  }

  async getBalance({ chatId, address, network }: GetBalanceParams): Promise<string> {
    const provider = this.networkProviders[network];

    return provider.getBalance({ address, network, chatId });
  }

  async sendTokens(sendTokensParams: SendTokensParams): Promise<void> {
    const { network } = sendTokensParams.wallet;
    const provider = this.networkProviders[network];

    return provider.sendTokens(sendTokensParams);
  }

  async sendNative(sendNativeParams: SendNativeParams): Promise<void> {
    const { network } = sendNativeParams.wallet;
    const provider = this.networkProviders[network];

    return provider.sendNative(sendNativeParams);
  }

  async createTestToken({ wallet, token }: DeployTokenParams): Promise<CreateTestTokenReturnType> {
    const { network } = token;
    const provider = this.testNetworkProviders[network];

    return provider.createTestToken({
      walletAddress: wallet.address,
      token,
    });
  }

  async fakeSwapTo(testToken: SessionUserToken): Promise<void> {
    const { network } = testToken;
    const provider = this.testNetworkProviders[network];

    await provider.fakeSwapTo(testToken);
  }

  async fakeSwapFrom(testToken: SessionUserToken): Promise<void> {
    const { network } = testToken;
    const provider = this.testNetworkProviders[network];

    await provider.fakeSwapFrom(testToken);
  }
}
