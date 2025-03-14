import { Injectable } from '@nestjs/common';
import { isEthereumAddress } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  createWalletClient,
  createPublicClient,
  http,
  Address,
  ContractFunctionExecutionError,
  formatEther,
  PublicClient,
  formatUnits,
  parseEther,
} from 'viem';

import { AnvilProvider } from './anvil/anvil.provider';
import { UserToken } from '@modules/user/user-token.entity';
import { RedisService } from '@modules/redis/redis.service';
import { encryptPrivateKey } from '@src/utils/crypto';
import { chains, erc20Abi } from '@src/utils/constants';
import { TestPuplicClient, ViemClientsType } from './types';
import { Network, SessionData, UserTestToken } from '@src/types/types';

@Injectable()
export class ViemProvider {
  private clients: ViemClientsType;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly anvilProvider: AnvilProvider,
  ) {
    this.clients = this.createClients();
  }

  async createWallet(network: Network) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv !== 'production') {
      await this.setTestBalance({ network, address: account.address });
    }

    return {
      network,
      encryptedPrivateKey: encryptPrivateKey({ privateKey, configService: this.configService }),
      address: account.address,
    };
  }

  private createClients(): ViemClientsType {
    const chainsArr = Object.entries(chains(this.configService));

    return chainsArr.reduce(
      (clients, [keyNetwork, value]) => {
        if (!chains(this.configService)[keyNetwork]) {
          throw new Error(`Неверная сеть: ${keyNetwork}`);
        }

        clients.public[keyNetwork] = createPublicClient({
          chain: value.chain,
          transport: http(value.rpcUrl),
        });

        clients.wallet[keyNetwork] = createWalletClient({
          chain: value.chain,
          transport: http(value.rpcUrl),
        });

        return clients;
      },
      { public: {}, wallet: {} } as ViemClientsType,
    );
  }

  async checkToken({
    address,
    network,
  }: {
    address: Address;
    network: Network;
  }): Promise<{ name: string; symbol: string; decimals: number }> {
    const networkClient = this.clients.public[network];

    try {
      const chainId = await networkClient.getChainId();
      const curChain = chains(this.configService)[network];
      if (chainId !== curChain.chain.id) {
        throw new Error(`Ошибка подключения к сети ${curChain.name}`);
      }

      const [name, symbol, decimals] = await Promise.all([
        networkClient.readContract({ address, abi: erc20Abi, functionName: 'name' }),
        networkClient.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
        networkClient.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
      ]);

      return {
        name,
        symbol,
        decimals,
      };
    } catch (error) {
      console.error(error);
      if (error instanceof ContractFunctionExecutionError) {
        throw new Error(`Этого токена не существует в сети ${network}`);
      }
      throw new Error(`Ошибка проверки токена`);
    }
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
    if (!isEthereumAddress(address)) throw new Error('Неверный формат адреса');

    const userSession = await this.redisService.getSessionData(chatId.toString());

    if (!userSession) throw new Error('Пользователь не найден');

    try {
      return await this.getFullBalance({ network, address, userSession });
    } catch (error) {
      console.error(error);
      throw new Error(`Ошибка получения баланса`);
    }
  }

  private async getFullBalance({
    network,
    address,
    userSession,
  }: {
    network: Network;
    address: Address;
    userSession: SessionData;
  }): Promise<string> {
    let balanceReply = '';
    let networkClient: PublicClient | TestPuplicClient;
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv !== 'production') {
      networkClient = this.anvilProvider.createTestNetworkClient('public', network);
    } else {
      networkClient = this.clients.public[network];
    }

    const chain = chains(this.configService)[network];
    const nativeBalance = await networkClient.getBalance({ address });
    const formattedNativeBalance = formatEther(nativeBalance);

    balanceReply += `<b>${chain.nativeCurrency.symbol}:</b> ${formattedNativeBalance}\n`;
    let reply = `<b>Адрес:</b> <code>${address}</code>\n`;
    reply += `<b>Сеть:</b> ${network}\n`;

    let tokens: (UserToken | UserTestToken)[] | undefined;
    tokens = nodeEnv !== 'production' ? userSession.testTokens : userSession.tokens;
    tokens = tokens?.filter(t => t.network === network);

    if (!tokens?.length) return (reply += balanceReply);

    for (const token of tokens) {
      const tokenBalance = await this.getTokenBalance({
        tokenAddress: token.address as Address,
        walletAddress: address,
        networkClient,
      });
      balanceReply += tokenBalance;
    }

    return (reply += balanceReply);
  }

  private async getTokenBalance({
    tokenAddress,
    walletAddress,
    networkClient,
  }: {
    tokenAddress: Address;
    walletAddress: Address;
    networkClient: PublicClient | TestPuplicClient;
  }): Promise<string> {
    const [balance, symbol, decimals] = await Promise.all([
      networkClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      }),
      networkClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'symbol' }),
      networkClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
    ]);

    const formattedBalance = formatUnits(balance, decimals);

    return `<b>${symbol}:</b> ${formattedBalance}\n`;
  }

  async setTestBalance({ network, address }: { network: Network; address: Address }) {
    if (!isEthereumAddress(address)) throw new Error('Неверный формат адреса');

    try {
      const client = this.anvilProvider.createTestNetworkClient('public', network);

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
