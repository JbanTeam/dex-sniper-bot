import { Injectable, OnModuleInit } from '@nestjs/common';
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
  webSocket,
  Log,
} from 'viem';

import { AnvilProvider } from './anvil/anvil.provider';
import { RedisService } from '@modules/redis/redis.service';
import { encryptPrivateKey } from '@src/utils/crypto';
import { chains, erc20Abi, erc20TransferEvent, isChainMonitoring } from '@src/utils/constants';
import { Transaction, ViemClientsType } from './types';
import { Network, SessionUserToken } from '@src/types/types';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { isEtherAddressArr, isNetworkArr } from '@src/types/typeGuards';

@Injectable()
export class ViemProvider implements OnModuleInit {
  private clients: ViemClientsType;
  private anvilClients: ViemClientsType;
  private unwatchCallbacks: { [key in Network]: () => void };

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly anvilProvider: AnvilProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv !== 'production') {
      this.anvilClients = this.anvilProvider.createClients();
    }

    this.clients = this.createClients();
    this.unwatchCallbacks = {} as { [key in Network]: () => void };
    Object.keys(chains(this.configService)).forEach(network => {
      this.unwatchCallbacks[network] = () => {};
    });
  }

  onModuleInit() {
    const networkKeys = Object.keys(chains(this.configService));
    isNetworkArr(networkKeys);

    for (const network of networkKeys) {
      this.monitorTokens({ network }).catch(error => {
        console.error('Error monitoring tokens:', error);
      });
    }
  }

  async createWallet(network: Network) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv !== 'production') {
      await this.anvilProvider.setTestBalance({ network, address: account.address });
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

        clients.publicWebsocket[keyNetwork] = createPublicClient({
          chain: value.chain,
          transport: webSocket(value.rpcUrl),
        });

        clients.wallet[keyNetwork] = createWalletClient({
          chain: value.chain,
          transport: http(value.rpcUrl),
        });

        return clients;
      },
      { public: {}, wallet: {}, publicWebsocket: {} } as ViemClientsType,
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
    try {
      const nodeEnv = this.configService.get<string>('NODE_ENV');
      const networkClient = nodeEnv !== 'production' ? this.anvilClients.public[network] : this.clients.public[network];

      const chain = chains(this.configService)[network];
      const nativeBalance = await networkClient.getBalance({ address });
      const formattedNativeBalance = formatEther(nativeBalance);
      let tokens =
        nodeEnv !== 'production'
          ? (await this.redisService.getTestTokens(chatId)) || []
          : (await this.redisService.getTokens(chatId)) || [];

      tokens = tokens.filter(t => t.network === network);

      let balanceReply = `<b>Адрес:</b> <code>${address}</code>\n`;
      balanceReply += `<b>Сеть:</b> ${network}\n`;
      balanceReply += `<b>${chain.nativeCurrency.symbol}:</b> ${formattedNativeBalance}\n`;

      if (!tokens.some((t: SessionUserToken) => t.network === network)) return balanceReply;

      for (const token of tokens) {
        const tokenBalance = await this.getTokenBalance({
          tokenAddress: token.address,
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

  @OnEvent('monitorTokens')
  async monitorTokens({ network }: { network: Network }): Promise<void> {
    console.log(`${network} enter monitorTokens`);

    const canMonitoringChain = await this.canMonitoringChain(network);
    console.log(`${network} canMonitoringChain`, canMonitoringChain);
    if (!canMonitoringChain) {
      isChainMonitoring[network] = false;
      this.unwatchCallbacks[network]();
      return;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const tokensAddresses =
      nodeEnv !== 'production'
        ? await this.redisService.getTestTokensSet(network)
        : await this.redisService.getTokensSet(network);
    const client =
      nodeEnv !== 'production' ? this.anvilClients.publicWebsocket[network] : this.clients.publicWebsocket[network];

    isEtherAddressArr(tokensAddresses);

    console.log(`${network}:tokensAddresses`, tokensAddresses);

    if (this.unwatchCallbacks[network]) this.unwatchCallbacks[network]();

    this.unwatchCallbacks[network] = client.watchEvent({
      address: tokensAddresses,
      onLogs: (logs: Log[]) => {
        console.log(logs[0].topics);
        Promise.all(
          logs.map(async log => {
            this.eventEmitter.emit('handleTransaction', { tx: this.parseTransactionLog(log, network) });
          }),
        ).catch(error => {
          console.error('Error processing logs:', error);
        });
      },
    });

    isChainMonitoring[network] = true;
  }

  async stopMonitoring() {
    Object.values(this.unwatchCallbacks).forEach(unwatch => unwatch());
  }

  private parseTransactionLog(log: Log, network: Network): Transaction | null {
    try {
      if (log.topics[0] === erc20TransferEvent) {
        const decimals = 18;

        return {
          hash: log.transactionHash ? log.transactionHash : `0x`,
          from: log.topics[1] ? this.decodeAddress(log.topics[1]) : `0x`,
          to: log.topics[2] ? this.decodeAddress(log.topics[2]) : `0x`,
          contractAddress: log.address,
          value: formatUnits(BigInt(log.data), decimals),
          data: log.data,
          network,
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing transaction log:', error);
      return null;
    }
  }

  private async canMonitoringChain(network: Network): Promise<boolean> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const arr: Promise<boolean>[] = [];

    arr.push(this.redisService.isSetEmpty(`subscriptions:${network}`));
    if (nodeEnv !== 'production') {
      arr.push(this.redisService.isSetEmpty(`testTokens:${network}`));
    } else {
      arr.push(this.redisService.isSetEmpty(`tokens:${network}`));
    }

    const [isTokensEmpty, isSubscriptionsEmpty] = await Promise.all(arr);

    return !isTokensEmpty && !isSubscriptionsEmpty;
  }

  private decodeAddress(topic: `0x${string}`): `0x${string}` {
    return `0x${topic.slice(26)}`;
  }
}
