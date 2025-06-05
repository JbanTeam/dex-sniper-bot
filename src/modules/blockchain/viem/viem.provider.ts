import { OnEvent } from '@nestjs/event-emitter';
import { HttpStatus, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  ContractFunctionExecutionError,
  formatEther,
  formatUnits,
  Log,
  parseUnits,
  parseEventLogs,
  erc20Abi,
  PublicClient,
  createPublicClient,
  http,
} from 'viem';

import { BotError } from '@libs/core/errors';
import { AnvilProvider } from './anvil/anvil.provider';
import { ViemHelperProvider } from './viem-helper.provider';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { MONITOR_DEX_EVENT, TRANSACTION_MAX_DEPTH } from '@src/constants';
import { encryptPrivateKey } from '@libs/core/utils';
import { BaseNetworkProvider } from '../BaseNetworkProvider';
import { isEtherAddressArr, isNetwork } from '@src/types/typeGuards';
import { Network, ViemNetwork } from '@src/types/types';
import {
  BalanceAllowanceParams,
  BalanceAllowanceReturnType,
  ReplicateTransactionParams,
  ViemClientsType,
} from './types';
import {
  BalanceInfo,
  CheckTokenParams,
  CheckTokenReturnType,
  CreateWalletReturnType,
  GetBalanceParams,
  GetTokenBalanceParams,
  SendNativeParams,
  SendTokensParams,
  TokenBalanceReturnType,
  Transaction,
} from '../types';
import { parsedPairAbi } from '@libs/abi';

@Injectable()
export class ViemProvider extends BaseNetworkProvider implements OnModuleInit, OnModuleDestroy {
  private clients: ViemClientsType;
  private unwatchCallbacks: { [key in ViemNetwork]: () => void };

  constructor(
    private readonly redisService: RedisService,
    private readonly subscriptionService: SubscriptionService,
    private readonly anvilProvider: AnvilProvider,
    private readonly viemHelper: ViemHelperProvider,
    private readonly constants: ConstantsProvider,
  ) {
    super();
  }
  async onModuleInit() {
    this.clients = this.viemHelper.getClients();

    if (this.constants.notProd) await this.viemHelper.initAnvil();

    this.unwatchCallbacks = this.viemHelper.initUnwatchCallbacks();

    const networkKeys = Object.keys(ViemNetwork);

    for (const network of networkKeys) {
      isNetwork(network);

      this.monitorDex({ network }).catch(error => {
        console.error('Error monitoring tokens:', error);
      });
    }
  }

  onModuleDestroy() {
    this.stopMonitoring();
  }

  async createWallet(network: Network): Promise<CreateWalletReturnType> {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    if (this.constants.notProd) {
      await this.anvilProvider.setTestBalance({ network, address: account.address });
    }

    return {
      network,
      encryptedPrivateKey: encryptPrivateKey({ privateKey, encryptKey: this.constants.ENCRYPT_KEY }),
      address: account.address,
    };
  }

  async checkToken({ address, network }: CheckTokenParams): Promise<CheckTokenReturnType> {
    let publicClient: PublicClient;

    const { chains, notProd } = this.constants;
    const { factoryAddress, nativeToken } = chains[network];

    if (notProd) {
      publicClient = createPublicClient({
        chain: chains[network].chain,
        transport: http(chains[network].rpcUrl),
      });
    } else {
      publicClient = this.clients.public[network];
    }

    try {
      const [name, symbol, decimals, pairAddresses] = await Promise.all([
        publicClient.readContract({ address, abi: erc20Abi, functionName: 'name' }),
        publicClient.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
        publicClient.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
        this.viemHelper.getPair({ tokenAddress: address, nativeToken, factoryAddress, publicClient }),
      ]);

      return { name, symbol, decimals, pairAddresses };
    } catch (error) {
      console.log(error);

      if (error instanceof ContractFunctionExecutionError) {
        throw new BotError(
          `This token does not exist in the network ${network}`,
          `Этого токена не существует в сети ${network}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new BotError(`Error checking token`, `Ошибка проверки токена`, HttpStatus.BAD_REQUEST);
    }
  }

  async getBalance({ chatId, address, network }: GetBalanceParams): Promise<string> {
    const publicClient = this.clients.public[network];

    const chain = this.constants.chains[network];
    const nativeBalance = await publicClient.getBalance({ address });
    const formattedNativeBalance = formatEther(nativeBalance);

    let tokens = this.constants.notProd
      ? (await this.redisService.getTokens(chatId, 'testTokens')) || []
      : (await this.redisService.getTokens(chatId, 'tokens')) || [];

    tokens = tokens.filter(t => t.network === network);

    const balanceInfo: BalanceInfo = {
      address,
      network,
      nativeBalance: {
        symbol: chain.tokenSymbol,
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

    return this.viemHelper.formatBalanceResponse(balanceInfo);
  }

  @OnEvent(MONITOR_DEX_EVENT)
  async monitorDex({ network }: { network: Network }): Promise<void> {
    this.unwatchCallbacks[network]();
    const client = this.clients.publicWebsocket[network];

    const prefix = this.constants.notProd ? 'testPairs' : 'pairs';
    const pairs = await this.redisService.getPairsSet(network, prefix);

    isEtherAddressArr(pairs);

    this.unwatchCallbacks[network] = client.watchEvent({
      address: pairs,
      onLogs: (logs: Log[]) => {
        (async () => {
          const parsedLogs = parseEventLogs({
            abi: parsedPairAbi,
            eventName: 'Swap',
            logs,
          });
          if (!parsedLogs.length) return;

          for (const log of parsedLogs) {
            const tx = await this.viemHelper.parseEventLog(log, network);
            if (!tx) continue;

            const context = await this.redisService.getTxContext(`txContext:${tx.hash}`);
            if (context) {
              tx.initiators = context.initiators ?? [];
              tx.replicationDepth = context.replicationDepth ?? 0;
            }

            const isSubscribed = await this.redisService.existsInSet(`subscriptions:${network}`, tx.userAddress);
            if (!isSubscribed) continue;

            const prefix = this.constants.notProd ? 'testTokens' : 'tokens';
            const tokenInExists = await this.redisService.existsInSet(`${prefix}:${network}`, tx.tokenIn);
            const tokenOutExists = await this.redisService.existsInSet(`${prefix}:${network}`, tx.tokenOut);

            if (!tokenInExists && !tokenOutExists) continue;

            await this.handleTransaction({ tx });
          }
        })().catch(error => {
          this.viemHelper.handleError(error, `Error monitoring dex ${network}`);
        });
      },
    });
  }

  stopMonitoring(): void {
    Object.values(this.unwatchCallbacks).forEach(unwatch => unwatch());
  }

  async sendTokens({ userSession, wallet, token, amount, recipientAddress }: SendTokensParams): Promise<void> {
    let tokenAddress = token.address;
    const { network } = wallet;
    const publicClient = this.clients.public[network];
    const currency = this.constants.chains[network].tokenSymbol;

    if (this.constants.notProd) {
      const testToken = userSession.testTokens?.find(t => t.id === token.id);

      if (testToken) tokenAddress = testToken.address;
    }

    try {
      const nativeBalance = await publicClient.getBalance({ address: wallet.address });

      if (nativeBalance === 0n) {
        throw new BotError(
          `Top up balance ${currency} for transaction`,
          `Пополните баланс <u>${currency}</u> для совершения транзакции`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const walletAddress = wallet.address;
      const tokenBalance = await this.viemHelper.balanceOf({ tokenAddress, walletAddress, publicClient });
      const txAmount = parseUnits(amount, token.decimals);

      if (tokenBalance < txAmount) {
        throw new BotError(
          `Not enough tokens ${token.symbol} on balance: ${tokenBalance}`,
          `Недостаточное количество токенов <u>${token.symbol}</u> на балансе: ${tokenBalance}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.viemHelper.transfer({ tokenAddress, wallet, recipientAddress, txAmount });
    } catch (error) {
      if (error?.details?.includes('Out of gas')) {
        throw new BotError(
          `Top up balance ${currency} for transaction`,
          `Пополните баланс <u>${currency}</u> для совершения транзакции`,
          HttpStatus.BAD_REQUEST,
        );
      }

      throw error;
    }
  }

  async sendNative({ wallet, amount, recipientAddress }: SendNativeParams): Promise<void> {
    const { network } = wallet;
    const publicClient = this.clients.public[network];
    const decimals = this.constants.chains[network].tokenDecimals;
    const currency = this.constants.chains[network].tokenSymbol;

    const txAmount = parseUnits(amount, decimals);

    try {
      const nativeBalance = await publicClient.getBalance({ address: wallet.address });
      if (nativeBalance === 0n || nativeBalance < txAmount) {
        throw new BotError(
          `Top up balance ${currency} for transaction`,
          `Пополните баланс <u>${currency}</u> для совершения транзакции`,
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.viemHelper.transferNative({ wallet, recipientAddress, txAmount });
    } catch (error) {
      if (error?.details?.includes('Out of gas')) {
        throw new BotError(
          `Top up balance ${currency} for transaction`,
          `Пополните баланс <u>${currency}</u> для совершения транзакции`,
          HttpStatus.BAD_REQUEST,
        );
      }

      throw error;
    }
  }

  private async getTokenBalance({
    tokenAddress,
    walletAddress,
    network,
  }: GetTokenBalanceParams): Promise<TokenBalanceReturnType> {
    const publicClient = this.clients.public[network];
    const [balanceAmount, symbol, decimals] = await Promise.all([
      this.viemHelper.balanceOf({ tokenAddress, walletAddress, publicClient }),
      publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'symbol' }),
      publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
    ]);

    return {
      symbol,
      decimals,
      amount: formatUnits(balanceAmount, decimals),
    };
  }

  private async handleTransaction({ tx }: { tx: Transaction }): Promise<void> {
    const subscriptions = await this.subscriptionService.findSubscriptionsByAddress(tx.userAddress);

    if (!subscriptions?.length) return;

    for (const subscription of subscriptions) {
      try {
        if (tx.initiators.includes(subscription.user.chat_id)) continue;

        if (tx.replicationDepth >= TRANSACTION_MAX_DEPTH) continue;

        await this.replicateTransaction({ subscription, tx });
      } catch (error) {
        if (error instanceof BotError) {
          error.chatId = subscription.user.chat_id;
        }

        if (error?.details?.includes('Out of gas')) {
          const currency = this.constants.chains[tx.network].tokenSymbol;
          throw new BotError(
            `Top up balance ${currency} for transaction`,
            `Пополните баланс <u>${currency}</u> для совершения транзакции`,
            HttpStatus.BAD_REQUEST,
          );
        }

        throw error;
      }
    }
  }

  private async checkBalanceAndAllowance({
    replication,
    account,
    tx,
    walletClient,
  }: BalanceAllowanceParams): Promise<BalanceAllowanceReturnType> {
    let balance: bigint;
    let currencyIn: string;
    let currencyOut: string;
    let formattedBalance: string;
    let formattedAmountIn: string;
    let inDecimals: number;
    let outDecimals: number;

    const { network, routerAddress, amountIn, tokenIn } = tx;
    const { nativeToken } = this.viemHelper.getSharedVars(network);
    const walletAddress = account.address;
    const publicClient = this.clients.public[network];
    const inIsNative = tokenIn === nativeToken;
    const chain = this.constants.chains[network];

    if (inIsNative) {
      balance = await publicClient.getBalance({ address: walletAddress });
      currencyIn = chain.tokenSymbol;
      currencyOut = replication.tokenSymbol;
      formattedBalance = formatEther(balance);
      formattedAmountIn = formatEther(amountIn);
      inDecimals = chain.tokenDecimals;
      outDecimals = replication.tokenDecimals;
    } else {
      balance = await this.viemHelper.balanceOf({ tokenAddress: tokenIn, walletAddress, publicClient });
      currencyIn = replication.tokenSymbol;
      currencyOut = chain.tokenSymbol;
      formattedBalance = formatUnits(balance, replication.tokenDecimals);
      formattedAmountIn = formatUnits(amountIn, replication.tokenDecimals);
      inDecimals = replication.tokenDecimals;
      outDecimals = chain.tokenDecimals;
    }

    if (balance < amountIn) {
      const exchange = this.constants.chains[network].exchange;
      let reply = `🚫 <b>Недостаточный баланс для совершения транзакции:</b>\n`;
      reply += `<b>Транзакция:</b> ${currencyIn} => ${currencyOut}\n`;
      reply += `<b>Баланс ${currencyIn}:</b> ${formattedBalance}\n`;
      reply += `<b>Требуемая сумма:</b> ${formattedAmountIn}\n`;
      reply += `<b>Подписка:</b> ${exchange} <code>${tx.sender}</code>\n`;
      throw new BotError(`Not enough balance ${currencyIn}`, reply, HttpStatus.BAD_REQUEST);
    }

    if (!inIsNative) {
      const allowance = await this.viemHelper.allowance({
        routerAddress,
        tokenAddress: tokenIn,
        walletAddress,
        network,
      });

      if (allowance < amountIn) {
        await this.viemHelper.approve({ tokenAddress: tokenIn, walletClient, tx, account });
      }
    }

    return { currencyIn, currencyOut, inDecimals, outDecimals };
  }

  private async replicateTransaction({ subscription, tx }: ReplicateTransactionParams): Promise<void> {
    const { chat_id } = subscription.user;
    const { network } = tx;
    const userSession = await this.redisService.getUser(chat_id);
    const wallet = subscription.user.wallets.find(wallet => wallet.network === network);

    if (!userSession.replications.length) return;

    const matchedReplication = this.viemHelper.getMatchedReplication({
      tx,
      replications: userSession.replications,
      subscriptionAddress: subscription.address,
    });

    if (!matchedReplication) return;

    if (!wallet) {
      throw new BotError(
        `Wallet for network ${network} not found`,
        `Кошелек для сети <u>${network}</u> не найден`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const walletAddress = wallet.address;
    const account = this.viemHelper.getAccount(wallet);
    const { chain, rpcUrl } = this.viemHelper.getSharedVars(network);
    const walletClient = this.viemHelper.getWalletClient(chain, rpcUrl, account);

    const { currencyIn, currencyOut, inDecimals, outDecimals } = await this.checkBalanceAndAllowance({
      replication: matchedReplication,
      account,
      tx,
      walletClient,
    });

    const { amountIn, amountOut } = await this.viemHelper.swap({
      walletAddress,
      tx,
      account,
      walletClient,
      chatId: chat_id,
    });

    const formattedAmountIn = formatUnits(amountIn, inDecimals);
    const formattedAmountOut = formatUnits(amountOut, outDecimals);

    const exchange = this.constants.chains[network].exchange;
    let reply = `🔁 <b>Повтор сделки совершен:</b>\n`;
    reply += `<b>Транзакция:</b> ${currencyIn} => ${currencyOut}\n`;
    reply += `<b>Получено:</b> ${formattedAmountOut} ${currencyOut}\n`;
    reply += `<b>Потрачено:</b> ${formattedAmountIn} ${currencyIn}\n`;
    reply += `<b>Подписка ${exchange}:</b> <code>${subscription.address}</code>`;

    this.viemHelper.notifyUser({ chatId: chat_id, text: reply });
  }
}
