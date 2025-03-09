import { Injectable } from '@nestjs/common';
import { isEthereumAddress } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  Address,
  ContractFunctionExecutionError,
  formatEther,
  PublicClient,
  formatUnits,
} from 'viem';

import { chains } from '@src/utils/constants';
import { RedisService } from '@modules/redis/redis.service';
import { encryptPrivateKey } from '@src/utils/crypto';
import { Network, ViemClientsType } from '@src/types/types';

@Injectable()
export class ViemProvider {
  private clients: ViemClientsType;

  private erc20Abi = parseAbi([
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
  ]);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.clients = this.createClients();
  }

  async createWallet(network: Network) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

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
    if (!isEthereumAddress(address)) {
      throw new Error('Неверный формат адреса токена');
    }

    const networkClient = this.clients.public[network];
    try {
      const chainId = await networkClient.getChainId();
      const curChain = chains(this.configService)[network];
      if (chainId !== curChain.chain.id) {
        throw new Error(`Ошибка подключения к сети ${curChain.name}`);
      }

      const [name, symbol, decimals] = await Promise.all([
        networkClient.readContract({ address, abi: this.erc20Abi, functionName: 'name' }),
        networkClient.readContract({ address, abi: this.erc20Abi, functionName: 'symbol' }),
        networkClient.readContract({ address, abi: this.erc20Abi, functionName: 'decimals' }),
      ]);

      return {
        name,
        symbol,
        decimals,
      };
    } catch (error) {
      console.error(error.message);
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
      let balanceReply = '';
      const networkClient = this.clients.public[network];
      const chain = chains(this.configService)[network];
      const nativeBalance = await networkClient.getBalance({ address });
      const formattedNativeBalance = formatEther(nativeBalance);
      balanceReply += `<b>${chain.nativeCurrency.symbol}:</b> ${formattedNativeBalance}\n`;

      const tokens = userSession.tokens?.filter(t => t.network === network);

      if (!tokens?.length) return balanceReply;

      for (const token of tokens) {
        const tokenBalance = await this.getTokenBalance({
          tokenAddress: token.address as Address,
          walletAddress: address,
          networkClient,
        });
        balanceReply += tokenBalance;
      }

      return balanceReply;
    } catch (error) {
      console.error(error);
      throw new Error(`Ошибка получения баланса`);
    }
  }

  private async getTokenBalance({
    tokenAddress,
    walletAddress,
    networkClient,
  }: {
    tokenAddress: Address;
    walletAddress: Address;
    networkClient: PublicClient;
  }): Promise<string> {
    const [balance, symbol, decimals] = await Promise.all([
      networkClient.readContract({
        address: tokenAddress,
        abi: this.erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      }),
      networkClient.readContract({ address: tokenAddress, abi: this.erc20Abi, functionName: 'symbol' }),
      networkClient.readContract({ address: tokenAddress, abi: this.erc20Abi, functionName: 'decimals' }),
    ]);

    const formattedBalance = formatUnits(balance, decimals);

    return `<b>${symbol}:</b> ${formattedBalance}\n`;
  }
}
