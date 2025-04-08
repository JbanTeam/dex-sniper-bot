import { anvil } from 'viem/chains';
import { ConfigService } from '@nestjs/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  createWalletClient,
  createPublicClient,
  http,
  Address,
  ContractFunctionExecutionError,
  formatEther,
  formatUnits,
  webSocket,
  Log,
  parseUnits,
} from 'viem';

import { Network } from '@src/types/types';
import { AnvilProvider } from './anvil/anvil.provider';
import { RedisService } from '@modules/redis/redis.service';
import { decodeLogAddress } from '@src/utils/utils';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { decryptPrivateKey, encryptPrivateKey } from '@src/utils/crypto';
import { isEtherAddressArr, isNetworkArr } from '@src/types/typeGuards';
import { anvilAbi, erc20Abi, erc20TransferEvent } from '@src/utils/constants';
import {
  BalanceInfo,
  GetBalanceParams,
  GetTokenBalanceParams,
  SendTokensParams,
  SendTransactionParams,
  TokenBalanceReturnType,
  Transaction,
  ViemClientsType,
} from './types';
import { BotError } from '@src/errors/BotError';

@Injectable()
export class ViemProvider implements OnModuleInit {
  private readonly nodeEnv: string;
  private readonly notProd: boolean;
  private readonly clients: ViemClientsType;
  private readonly anvilClients: ViemClientsType;
  private unwatchCallbacks: { [key in Network]: () => void };

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly anvilProvider: AnvilProvider,
    private readonly constants: ConstantsProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    this.notProd = this.nodeEnv !== 'production';

    if (this.notProd) this.anvilClients = this.anvilProvider.createClients();

    this.clients = this.createClients();
    this.unwatchCallbacks = {} as { [key in Network]: () => void };
    Object.keys(this.constants.chains).forEach(network => {
      this.unwatchCallbacks[network] = () => {};
    });
  }

  onModuleInit() {
    const networkKeys = Object.keys(this.constants.chains);
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

    if (this.notProd) {
      await this.anvilProvider.setTestBalance({ network, address: account.address });
    }

    return {
      network,
      encryptedPrivateKey: encryptPrivateKey({ privateKey, encryptKey: this.constants.ENCRYPT_KEY }),
      address: account.address,
    };
  }

  async checkToken({
    address,
    network,
  }: {
    address: Address;
    network: Network;
  }): Promise<{ name: string; symbol: string; decimals: number }> {
    const publicClient = this.clients.public[network];

    try {
      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({ address, abi: erc20Abi, functionName: 'name' }),
        publicClient.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
        publicClient.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
      ]);

      return {
        name,
        symbol,
        decimals,
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new BotError(
          `This token does not exist in the network ${network}`,
          `Этого токена не существует в сети ${network}`,
          400,
        );
      }
      throw new BotError(`Error checking token`, `Ошибка проверки токена`, 400);
    }
  }

  async getBalance({ chatId, address, network }: GetBalanceParams): Promise<string> {
    const publicClient = this.notProd ? this.anvilClients.public[network] : this.clients.public[network];

    const chain = this.constants.chains[network];
    const nativeBalance = await publicClient.getBalance({ address });
    const formattedNativeBalance = formatEther(nativeBalance);

    let tokens = this.notProd
      ? (await this.redisService.getTestTokens(chatId)) || []
      : (await this.redisService.getTokens(chatId)) || [];

    tokens = tokens.filter(t => t.network === network);

    const balanceInfo: BalanceInfo = {
      address,
      network,
      nativeBalance: {
        symbol: chain.nativeCurrency.symbol,
        amount: formattedNativeBalance,
      },
      tokenBalances: [] as Array<{
        symbol: string;
        amount: string;
        decimals: number;
      }>,
    };

    if (tokens.length) {
      const tokenBalances = await Promise.all(
        tokens.map(token =>
          this.getTokenBalance({
            tokenAddress: token.address,
            walletAddress: address,
            network,
          }),
        ),
      );

      balanceInfo.tokenBalances = tokenBalances;
    }

    return this.formatBalanceResponse(balanceInfo);
  }

  async getTokenBalance({
    tokenAddress,
    walletAddress,
    network,
  }: GetTokenBalanceParams): Promise<TokenBalanceReturnType> {
    const publicClient = this.notProd ? this.anvilClients.public[network] : this.clients.public[network];
    const [balance, symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      }),
      publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'symbol' }),
      publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
    ]);

    const formattedBalance = formatUnits(balance, decimals);

    return {
      symbol,
      decimals,
      amount: formattedBalance,
    };
  }

  @OnEvent('monitorTokens')
  async monitorTokens({ network }: { network: Network }): Promise<void> {
    console.log(`${network} enter monitorTokens`);

    const canMonitoringChain = await this.canMonitoringChain(network);
    console.log(`${network} canMonitoringChain`, canMonitoringChain);
    if (!canMonitoringChain) {
      this.constants.isChainMonitoring[network] = false;
      this.unwatchCallbacks[network]();
      return;
    }

    const tokensAddresses = this.notProd
      ? await this.redisService.getTestTokensSet(network)
      : await this.redisService.getTokensSet(network);
    const client = this.notProd ? this.anvilClients.publicWebsocket[network] : this.clients.publicWebsocket[network];

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
          throw error;
        });
      },
    });

    this.constants.isChainMonitoring[network] = true;
  }

  async stopMonitoring() {
    Object.values(this.unwatchCallbacks).forEach(unwatch => unwatch());
  }

  async sendTokens({ wallet, tokenAddress, amount, recipientAddress }: SendTokensParams) {
    const {
      symbol,
      amount: balance,
      decimals,
    } = await this.getTokenBalance({
      tokenAddress,
      walletAddress: wallet.address,
      network: wallet.network,
    });

    if (+balance < +amount) {
      throw new BotError(
        `Not enough tokens ${symbol} on balance: ${balance}`,
        `Недостаточное количество токенов <u>${symbol}</u> на балансе: ${balance}`,
        400,
      );
    }

    await this.sendTransaction({
      tokenAddress,
      wallet,
      recipientAddress,
      amount,
      decimals,
    });
  }

  private createClients(): ViemClientsType {
    const chainsArr = Object.entries(this.constants.chains);

    return chainsArr.reduce(
      (clients, [keyNetwork, value]) => {
        clients.public[keyNetwork] = createPublicClient({
          chain: value.chain,
          transport: http(value.rpcUrl),
        });

        clients.publicWebsocket[keyNetwork] = createPublicClient({
          chain: value.chain,
          transport: webSocket(value.rpcUrl),
        });

        return clients;
      },
      { public: {}, publicWebsocket: {} } as ViemClientsType,
    );
  }

  private async sendTransaction({ tokenAddress, wallet, recipientAddress, amount, decimals }: SendTransactionParams) {
    const { network } = wallet;
    const { chains } = this.constants;
    const transactionAmount = parseUnits(amount, decimals);
    const currency = chains[network].nativeCurrency.symbol;
    const publicClient = this.notProd ? this.anvilClients.public[network] : this.clients.public[network];

    const account = privateKeyToAccount(
      decryptPrivateKey({ encryptedPrivateKey: wallet.encryptedPrivateKey, encryptKey: this.constants.ENCRYPT_KEY }),
    );

    const nativeBalance = await publicClient.getBalance({ address: account.address });
    if (nativeBalance === 0n)
      throw new BotError(
        `Top up balance ${currency} for transaction`,
        `Пополните баланс <u>${currency}</u> для совершения транзакции`,
        400,
      );

    const abi = this.notProd ? anvilAbi : erc20Abi;
    const chain = this.notProd ? anvil : chains[network].chain;
    const rpcUrl = this.notProd ? this.constants.ANVIL_RPC_URL : chains[network].rpcUrl;

    const walletClient = createWalletClient({
      chain,
      transport: http(rpcUrl),
      account,
    });

    try {
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi,
        chain,
        functionName: 'transfer',
        args: [recipientAddress, transactionAmount],
        account,
      });

      console.log('Transaction hash:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== 'success') {
        throw new BotError(`Tokens not sent ❌`, `Токены не были отправлены ❌`, 400);
      }

      console.log('✅ Токены отправлены', receipt);
    } catch (error) {
      if (error?.details?.includes('Out of gas')) {
        throw new BotError(
          `Top up balance ${currency} for transaction`,
          `Пополните баланс <u>${currency}</u> для совершения транзакции`,
          400,
        );
      }
      throw error;
    }
  }

  private formatBalanceResponse(balanceInfo: BalanceInfo): string {
    const { address, network, nativeBalance, tokenBalances } = balanceInfo;
    let balanceReply = `<b>Адрес:</b> <code>${address}</code>\n`;
    balanceReply += `<b>Сеть:</b> ${network}\n`;
    balanceReply += `<b>${nativeBalance.symbol}:</b> ${nativeBalance.amount}\n`;

    for (const token of tokenBalances) {
      balanceReply += `<b>${token.symbol}:</b> ${token.amount}\n`;
    }

    return balanceReply;
  }

  private parseTransactionLog(log: Log, network: Network): Transaction | null {
    try {
      if (log.topics[0] === erc20TransferEvent) {
        const decimals = 18;

        return {
          hash: log.transactionHash ? log.transactionHash : `0x`,
          from: log.topics[1] ? decodeLogAddress(log.topics[1]) : `0x`,
          to: log.topics[2] ? decodeLogAddress(log.topics[2]) : `0x`,
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
    const arr: Promise<boolean>[] = [];

    arr.push(this.redisService.isSetEmpty(`subscriptions:${network}`));
    if (this.notProd) {
      arr.push(this.redisService.isSetEmpty(`testTokens:${network}`));
    } else {
      arr.push(this.redisService.isSetEmpty(`tokens:${network}`));
    }

    const [isTokensEmpty, isSubscriptionsEmpty] = await Promise.all(arr);

    return !isTokensEmpty && !isSubscriptionsEmpty;
  }
}
