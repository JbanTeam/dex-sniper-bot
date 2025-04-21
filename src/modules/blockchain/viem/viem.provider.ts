import { anvil } from 'viem/chains';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  createWalletClient,
  createPublicClient,
  http,
  ContractFunctionExecutionError,
  formatEther,
  formatUnits,
  webSocket,
  Log,
  parseUnits,
  parseEventLogs,
} from 'viem';

import { isSwapLog } from './typeGuards';
import { BotError } from '@src/errors/BotError';
import { AnvilProvider } from './anvil/anvil.provider';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { abi as routerAbi } from '@src/contract-artifacts/MockRouter.json';
import { Address, Network, ViemNetwork } from '@src/types/types';
import { decryptPrivateKey, encryptPrivateKey } from '@src/utils/crypto';
import { isNetwork, isNetworkArr } from '@src/types/typeGuards';
import { anvilAbi, erc20Abi } from '@src/utils/constants';
import { SendTransactionParams, ViemClientsType } from './types';
import {
  BalanceInfo,
  CheckTokenParams,
  CheckTokenReturnType,
  GetBalanceParams,
  GetTokenBalanceParams,
  SendTokensParams,
  TokenBalanceReturnType,
  Transaction,
} from '../types';

@Injectable()
export class ViemProvider implements OnModuleInit {
  private readonly nodeEnv: string;
  private readonly notProd: boolean;
  private readonly clients: ViemClientsType;
  private readonly anvilClients: ViemClientsType;
  private unwatchCallbacks: { [key in Network]: () => void };

  constructor(
    private readonly redisService: RedisService,
    private readonly anvilProvider: AnvilProvider,
    private readonly constants: ConstantsProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.nodeEnv = this.constants.NODE_ENV;
    this.notProd = this.nodeEnv !== 'production';

    if (this.notProd) {
      this.anvilClients = this.anvilProvider.createClients();
    }

    this.clients = this.createClients();
    this.unwatchCallbacks = {} as { [key in ViemNetwork]: () => void };
    Object.keys(ViemNetwork).forEach(network => {
      this.unwatchCallbacks[network] = () => {};
    });
  }

  async onModuleInit() {
    if (this.notProd) {
      await this.anvilProvider.initExchangeTestAddresses();
      await this.anvilProvider.initTestDex();
    }

    const networkKeys = Object.keys(ViemNetwork);
    isNetworkArr(networkKeys);

    for (const network of networkKeys) {
      this.monitorDex({ network }).catch(error => {
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

  async checkToken({ address, network }: CheckTokenParams): Promise<CheckTokenReturnType> {
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
      ? (await this.redisService.getTokens(chatId, 'testTokens')) || []
      : (await this.redisService.getTokens(chatId, 'tokens')) || [];

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

  async monitorDex({ network }: { network: Network }): Promise<void> {
    console.log(`${network} enter monitorDex`);

    let routerAddresses: Address[] = [];

    if (this.notProd) {
      const cachedContracts = await this.redisService.getCachedContracts();
      routerAddresses = [cachedContracts.router];
    } else {
      routerAddresses = this.constants.chains[network].routerAddresses;
    }

    const client = this.notProd ? this.anvilClients.publicWebsocket[network] : this.clients.publicWebsocket[network];

    this.unwatchCallbacks[network] = client.watchEvent({
      address: routerAddresses,
      onLogs: (logs: Log[]) => {
        (async () => {
          const parsedLogs = parseEventLogs({
            abi: routerAbi,
            eventName: 'Swap',
            logs,
          });

          for (const log of parsedLogs) {
            const tx = this.parseEventLog(log, network);
            if (!tx) continue;

            const isSubscribed = await this.redisService.existsInSet(`subscriptions:${network}`, tx.sender);
            if (!isSubscribed) continue;

            const prefix = this.notProd ? 'testTokens' : 'tokens';
            const tokenInExists = await this.redisService.existsInSet(`${prefix}:${network}`, tx.tokenIn);
            const tokenOutExists = await this.redisService.existsInSet(`${prefix}:${network}`, tx.tokenOut);
            if (!tokenInExists && !tokenOutExists) continue;

            this.eventEmitter.emit('handleTransaction', { tx });
          }
        })().catch(error => console.error('Error processing logs:', error));
      },
    });
  }

  async stopMonitoring() {
    Object.values(this.unwatchCallbacks).forEach(unwatch => unwatch());
  }

  async sendTokens({ userSession, wallet, token, amount, recipientAddress }: SendTokensParams) {
    let tokenAddress = token.address;
    if (this.notProd) {
      const testToken = userSession.testTokens?.find(t => t.id === token.id);
      if (testToken) tokenAddress = testToken.address;
    }

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
    const chainsArr = Object.keys(ViemNetwork);

    return chainsArr.reduce(
      (clients, keyNetwork) => {
        isNetwork(keyNetwork);
        const value = this.constants.chains[keyNetwork];
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

      console.log('#️⃣ Transaction hash:', hash);

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

  private parseEventLog(log: Log, network: Network): Transaction | null {
    if (!isSwapLog(log)) return null;
    const parsedLog: Transaction = {
      eventName: log.eventName,
      routerAddress: log.address.toLowerCase() as Address,
      sender: log.args.sender.toLowerCase() as Address,
      amountIn: log.args.amountIn,
      amountOut: log.args.amountOut,
      tokenIn: log.args.tokenIn.toLowerCase() as Address,
      tokenOut: log.args.tokenOut.toLowerCase() as Address,
      network,
      data: log.data,
    };

    return parsedLog;
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
