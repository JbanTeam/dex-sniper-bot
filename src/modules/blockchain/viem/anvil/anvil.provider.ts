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
  webSocket,
  parseEther,
  WalletClient,
  PublicClient,
} from 'viem';

import { coinContract } from './coin-contract';
import { Network, SessionUserToken } from '@src/types/types';
import { anvilAbi, chains } from '@src/utils/constants';
import {
  TestBalanceParams,
  SendTestTokenParams,
  DeployTestContractParams,
  ViemClientsType,
  DeployContractParams,
} from '../types';

@Injectable()
export class AnvilProvider {
  private walletClient: WalletClient;
  private publicClient: PublicClient;

  constructor(private readonly configService: ConfigService) {
    const anvilRpcUrl = this.configService.get<string>('ANVIL_RPC_URL', 'http://dex_sniper-anvil:8545');
    this.walletClient = createWalletClient({
      chain: anvil,
      transport: http(anvilRpcUrl),
    });
    this.publicClient = createPublicClient({
      chain: anvil,
      transport: http(anvilRpcUrl),
    });
  }

  createClients(): ViemClientsType {
    const chainsArr = Object.entries(chains(this.configService));

    const rpcUrl = this.configService.get<string>(`ANVIL_RPC_URL`, 'http://dex_sniper-anvil:8545');
    const rpcWsUrl = this.configService.get<string>(`ANVIL_WS_RPC_URL`, 'ws://dex_sniper-anvil:8545');

    return chainsArr.reduce(
      (clients, [keyNetwork, value]) => {
        if (!chains(this.configService)[keyNetwork]) {
          throw new Error(`Неверная сеть: ${keyNetwork}`);
        }

        clients.public[keyNetwork] = createPublicClient({
          chain: value.chain,
          transport: http(rpcUrl),
        });

        clients.publicWebsocket[keyNetwork] = createPublicClient({
          chain: value.chain,
          transport: webSocket(rpcWsUrl),
        });

        return clients;
      },
      { public: {}, publicWebsocket: {} } as ViemClientsType,
    );
  }

  async deployTestContract({
    token,
    count = '1000000000',
    walletAddress,
  }: DeployTestContractParams): Promise<SessionUserToken> {
    const { name, symbol, decimals } = token;
    const { testAccount, contractAddress } = await this.deployContract({ name, symbol, decimals, count });

    await this.getBalance({ contractAddress, testAccount, name, decimals });

    await this.sendTestTokens({ contractAddress, testAccount, walletAddress, decimals });

    return {
      ...token,
      address: contractAddress,
    };
  }

  private async deployContract({ name, symbol, decimals, count }: DeployContractParams): Promise<{
    testAccount: Address;
    contractAddress: Address;
  }> {
    const [testAccount] = await this.walletClient.getAddresses();
    // TODO: ?
    // exchangeAddresses[Network.BSC].exchangeAddress = testAccount;
    // exchangeAddresses[Network.BSC].testAddress = secondAccount;

    const txHash = await this.walletClient.deployContract({
      abi: coinContract.abi,
      chain: anvil,
      bytecode: coinContract.bytecode as `0x${string}`,
      account: testAccount,
      args: [name, symbol, decimals, count],
    });

    console.log(`✅ Контракт ${name} отправлен, Транзакция: ${txHash}`);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    if (!receipt.contractAddress) {
      throw new Error(`❌ Ошибка: тестовый контракт ${name} не был создан!`);
    }

    const contractAddress = receipt.contractAddress;
    console.log(`✅ Контракт развернут по адресу: ${contractAddress}`);

    return { testAccount, contractAddress };
  }

  private async getBalance({ contractAddress, testAccount, decimals, name }: TestBalanceParams) {
    const balance = await this.publicClient.readContract({
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

    const hash = await this.walletClient.writeContract({
      address: contractAddress,
      abi: anvilAbi,
      chain: anvil,
      functionName: 'transfer',
      args: [walletAddress, amount],
      account: testAccount,
    });

    console.log('Transaction hash:', hash);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new Error(`❌ Ошибка: тестовые токены не были отправлены!`);
    }

    console.log('✅ Токены отправлены', receipt);
  }

  async sendFakeTransaction(testToken: SessionUserToken) {
    const [pancakeAddress, secondAccount] = await this.walletClient.getAddresses();
    // const pancakeAddress = exchangeAddresses[Network.BSC].exchangeAddress;
    // const secondAccount = exchangeAddresses[Network.BSC].testAddress;

    const amount = parseUnits('1000.0', testToken.decimals);
    const hash = await this.walletClient.writeContract({
      address: testToken.address,
      abi: anvilAbi,
      chain: anvil,
      functionName: 'transfer',
      args: [secondAccount, amount],
      account: pancakeAddress,
    });

    console.log('Transaction hash:', hash);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new Error(`❌ Ошибка: тестовые токены не были отправлены!`);
    }

    console.log('✅ Токены отправлены', receipt);

    await this.getBalance({
      contractAddress: testToken.address,
      testAccount: secondAccount,
      name: testToken.name,
      decimals: testToken.decimals,
    });
  }

  async setTestBalance({ network, address }: { network: Network; address: Address }) {
    try {
      const rpcUrl = this.configService.get<string>(`ANVIL_RPC_URL`, 'http://dex_sniper-anvil:8545');
      const client = createTestClient({
        mode: 'anvil',
        chain: chains(this.configService)[network].chain,
        transport: http(rpcUrl),
      }).extend(publicActions);

      await client.request({
        method: 'anvil_setBalance',
        params: [address, `0x${parseEther('1000').toString(16)}`],
      });
    } catch (error) {
      console.error(error);
      throw new Error(`Ошибка установления баланса`);
    }
  }
}
