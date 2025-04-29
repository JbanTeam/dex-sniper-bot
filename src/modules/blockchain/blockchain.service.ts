import { Injectable } from '@nestjs/common';

import { ViemProvider } from './viem/viem.provider';
import { AnvilProvider } from './viem/anvil/anvil.provider';
import { Wallet } from '@modules/wallet/wallet.entity';
import { WalletService } from '@modules/wallet/wallet.service';
import { Network, NetworkProviders, SessionUserToken } from '@src/types/types';
import {
  CheckTokenParams,
  CheckTokenReturnType,
  CreateWalletParams,
  DeployTestContractParams,
  GetBalanceParams,
  SendTokensParams,
} from './types';

@Injectable()
export class BlockchainService {
  private readonly networkProviders: NetworkProviders;
  constructor(
    private readonly viemProvider: ViemProvider,
    private readonly anvilProvider: AnvilProvider,
    private readonly walletService: WalletService,
  ) {
    this.networkProviders = {
      [Network.BSC]: this.viemProvider,
      [Network.POLYGON]: this.viemProvider,
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

  async sendTokens(sendTokensParams: SendTokensParams) {
    const { network } = sendTokensParams.wallet;
    const provider = this.networkProviders[network];
    return provider.sendTokens(sendTokensParams);
  }

  async createTestToken({ wallet, token }: DeployTestContractParams) {
    // TODO: testProviders
    return this.anvilProvider.createTestToken({
      walletAddress: wallet.address,
      token,
    });
  }

  async sendFakeSwap(testToken: SessionUserToken) {
    return this.anvilProvider.sendFakeSwap(testToken);
  }
}
