import { anvil } from 'viem/chains';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createWalletClient,
  createPublicClient,
  http,
  Address,
  formatUnits,
  parseUnits,
  createTestClient,
  publicActions,
  walletActions,
} from 'viem';

import { coinContract } from './coin-contract';
import { Network, UserTestToken } from '@src/types/types';
import { anvilAbi, chains } from '@src/utils/constants';
import {
  TestBalanceParams,
  SendTestTokenParams,
  DeployTestContractParams,
  TestPuplicClient,
  TestWalletClient,
} from '../types';

@Injectable()
export class AnvilProvider {
  private anvilClient = createWalletClient({
    chain: anvil,
    transport: http('http://dex_sniper-anvil:8545'),
  });

  private anvilClientPublic = createPublicClient({
    chain: anvil,
    transport: http('http://dex_sniper-anvil:8545'),
  });

  constructor(private readonly configService: ConfigService) {}

  async deployTestContract({
    name,
    symbol,
    decimals,
    network,
    count = '1000000000',
    walletAddress,
  }: DeployTestContractParams): Promise<UserTestToken> {
    const { testAccount, contractAddress } = await this.deployContract({ name, symbol, decimals, count });

    await this.getBalance({ contractAddress, testAccount, name, decimals });

    await this.sendTestTokens({ contractAddress, testAccount, walletAddress, decimals });

    return {
      name,
      symbol,
      decimals,
      network,
      address: contractAddress,
    };
  }

  private async deployContract({
    name,
    symbol,
    decimals,
    count,
  }: Omit<DeployTestContractParams, 'walletAddress' | 'network'>): Promise<{
    testAccount: Address;
    contractAddress: Address;
  }> {
    const [testAccount] = await this.anvilClient.getAddresses();

    const txHash = await this.anvilClient.deployContract({
      abi: coinContract.abi,
      bytecode: coinContract.bytecode as `0x${string}`,
      account: testAccount,
      args: [name, symbol, decimals, count],
    });

    console.log(`✅ Контракт ${name} отправлен, Транзакция: ${txHash}`);

    const receipt = await this.anvilClientPublic.waitForTransactionReceipt({ hash: txHash });

    if (!receipt.contractAddress) {
      throw new Error(`❌ Ошибка: тестовый контракт ${name} не был создан!`);
    }

    const contractAddress = receipt.contractAddress;
    console.log(`✅ Контракт развернут по адресу: ${contractAddress}`);

    return { testAccount, contractAddress };
  }

  private async getBalance({ contractAddress, testAccount, decimals, name }: TestBalanceParams) {
    const balance = await this.anvilClientPublic.readContract({
      address: contractAddress,
      abi: anvilAbi,
      functionName: 'balanceOf',
      args: [testAccount],
    });

    const formattedBalance = formatUnits(balance, decimals);

    console.log(`💰 Баланс ${name}:`, formattedBalance);
  }

  private async sendTestTokens({ contractAddress, testAccount, walletAddress, decimals }: SendTestTokenParams) {
    const amount = parseUnits('1000000.0', decimals);

    const hash = await this.anvilClient.writeContract({
      address: contractAddress,
      abi: anvilAbi,
      functionName: 'transfer',
      args: [walletAddress, amount],
      account: testAccount,
    });

    console.log('Transaction hash:', hash);

    const receipt = await this.anvilClientPublic.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new Error(`❌ Ошибка: тестовые токены не были отправлены!`);
    }

    console.log('✅ Токены отправлены', receipt);
  }

  createTestNetworkClient(type: 'public', network: Network): TestPuplicClient;
  createTestNetworkClient(type: 'wallet', network: Network): TestWalletClient;
  createTestNetworkClient(type: 'public' | 'wallet', network: Network): TestPuplicClient | TestWalletClient {
    const client = createTestClient({
      mode: 'anvil',
      chain: chains(this.configService)[network].chain,
      transport: http('http://dex_sniper-anvil:8545'),
    });
    switch (type) {
      case 'public':
        return client.extend(publicActions);
      case 'wallet':
        return client.extend(walletActions);
    }
  }
}
