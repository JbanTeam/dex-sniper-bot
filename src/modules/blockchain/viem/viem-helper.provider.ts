import { anvil } from 'viem/chains';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { privateKeyToAccount } from 'viem/accounts';
import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Account,
  Chain,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  Log,
  parseEventLogs,
  WalletClient,
  webSocket,
} from 'viem';

import { isSwapLog } from './typeGuards';
import { AnvilProvider } from './anvil/anvil.provider';
import { BotError } from '@src/errors/BotError';
import { isNetwork } from '@src/types/typeGuards';
import { decryptPrivateKey } from '@src/utils/crypto';
import { Wallet } from '@modules/wallet/wallet.entity';
import { RedisService } from '@modules/redis/redis.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { parsedFactoryAbi, parsedPairAbi, parsedRouterAbi } from '@src/utils/constants';
import { abi as routerAbi } from '@src/contract-artifacts/UniswapV2Router02.json';
import { BalanceInfo, PairAddresses, Transaction } from '../types';
import { Address, Network, SessionReplication, ViemNetwork } from '@src/types/types';
import {
  AllowanceParams,
  ApproveParams,
  BalanceOfParams,
  CachedContractsType,
  ErcSwapFnType,
  TransferParams,
  SwapParams,
  ViemClientsType,
  TransferNativeParams,
  UnwatchCallback,
  InitSwapArgsParams,
  InitSwapArgsReturnType,
  SharedVarsReturnType,
  MatchedReplicationParams,
  SwapReturnType,
  GetPairParams,
} from './types';

@Injectable()
export class ViemHelperProvider implements OnModuleInit {
  private readonly logger = new Logger(ViemHelperProvider.name);
  private cachedContracts: CachedContractsType = {} as CachedContractsType;
  private readonly clients: ViemClientsType;

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => AnvilProvider))
    private readonly anvilProvider: AnvilProvider,
    private readonly constants: ConstantsProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {
    if (this.constants.notProd) {
      this.clients = this.anvilProvider.createClients();
    } else {
      this.clients = this.createClients();
    }
  }

  async onModuleInit() {
    if (this.constants.notProd) {
      this.cachedContracts = await this.redisService.getCachedContracts();
    }
  }

  createClients(): ViemClientsType {
    const chainsArr = Object.keys(ViemNetwork);

    return chainsArr.reduce(
      (clients, keyNetwork) => {
        isNetwork(keyNetwork);
        const { chain, rpcUrl, rpcWsUrl } = this.constants.chains[keyNetwork];
        clients.public[keyNetwork] = createPublicClient({
          chain,
          transport: http(rpcUrl),
        });

        clients.publicWebsocket[keyNetwork] = createPublicClient({
          chain,
          transport: webSocket(rpcWsUrl),
        });

        return clients;
      },
      { public: {}, publicWebsocket: {} } as ViemClientsType,
    );
  }

  getClients(): ViemClientsType {
    return this.clients;
  }

  initUnwatchCallbacks(): UnwatchCallback {
    const unwatchCallbacks = {} as UnwatchCallback;
    Object.keys(ViemNetwork).forEach(network => {
      unwatchCallbacks[network] = () => {};
    });

    return unwatchCallbacks;
  }

  async initAnvil(): Promise<void> {
    await this.anvilProvider.initTestAddresses();
    await this.anvilProvider.initTestDex();
  }

  async initSwapArgs({ tx, walletAddress, slippageBps = 300 }: InitSwapArgsParams): Promise<InitSwapArgsReturnType> {
    const { tokenIn, tokenOut, amountIn } = tx;
    const { nativeToken } = this.getSharedVars(tx.network);
    const publicClient = this.clients.public[tx.network];

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);
    const isTokenInNative = tokenIn === nativeToken;
    const isTokenOutNative = tokenOut === nativeToken;
    const path = [tokenIn, tokenOut];

    const [, expectedAmountOut] = await publicClient.readContract({
      address: tx.routerAddress,
      abi: parsedRouterAbi,
      functionName: 'getAmountsOut',
      args: [amountIn, path],
    });

    const minAmountOut = (expectedAmountOut * BigInt(10000 - slippageBps)) / 10000n;

    let fn: ErcSwapFnType;

    let args: any[];
    let value: bigint | undefined;

    if (isTokenInNative) {
      fn = 'swapExactETHForTokens';
      args = [minAmountOut, path, walletAddress, deadline] as const;
      value = amountIn;
    } else if (isTokenOutNative) {
      fn = 'swapExactTokensForETH';
      args = [amountIn, minAmountOut, path, walletAddress, deadline] as const;
      value = undefined;
    } else {
      fn = 'swapExactTokensForTokens';
      args = [amountIn, minAmountOut, path, walletAddress, deadline] as const;
      value = undefined;
    }

    return { fn, args, value };
  }

  getSharedVars(network: Network): SharedVarsReturnType {
    const { chains, notProd, ANVIL_RPC_URL } = this.constants;
    const chain = notProd ? anvil : chains[network].chain;
    const rpcUrl = notProd ? ANVIL_RPC_URL : chains[network].rpcUrl;
    const nativeToken = notProd ? this.cachedContracts.nativeToken : chains[network].nativeToken;
    const routerAddress = notProd ? this.cachedContracts.routerAddress : chains[network].routerAddress;
    return { chain, rpcUrl, nativeToken, routerAddress };
  }

  formatBalanceResponse(balanceInfo: BalanceInfo): string {
    const { address, network, nativeBalance, tokenBalances } = balanceInfo;
    let balanceReply = `<b>Адрес:</b> <code>${address}</code>\n`;
    balanceReply += `<b>Сеть:</b> ${network}\n`;
    balanceReply += `<b>${nativeBalance.symbol}:</b> ${nativeBalance.amount}\n`;

    for (const token of tokenBalances) {
      balanceReply += `<b>${token.symbol}:</b> ${token.amount}\n`;
    }

    return balanceReply;
  }

  async parseEventLog(log: Log, network: Network): Promise<Transaction | null> {
    if (!isSwapLog(log)) return null;
    let tokenIn: Address;
    let tokenOut: Address;
    const { chains, notProd } = this.constants;
    const { address, eventName } = log;
    const { sender, to, amount0In, amount1In, amount0Out, amount1Out } = log.args;
    const prefix = notProd ? 'testPair' : 'pair';
    const pair = await this.redisService.getPair({ prefix, pairAddress: address, network });
    const routerAddress = notProd ? this.cachedContracts.routerAddress : chains[network].routerAddress;

    if (!pair) return null;

    if (amount0In > 0) {
      tokenIn = pair.token0;
      tokenOut = pair.token1;
    } else {
      tokenIn = pair.token1;
      tokenOut = pair.token0;
    }
    const amountIn = amount0In + amount1In;
    const amountOut = amount0Out + amount1Out;
    const parsedLog: Transaction = {
      eventName,
      pairAddress: address.toLowerCase() as Address,
      routerAddress: routerAddress.toLowerCase() as Address,
      sender: sender.toLowerCase() as Address,
      to: to.toLowerCase() as Address,
      amountIn,
      amountOut,
      tokenIn,
      tokenOut,
      network,
      hash: log.transactionHash.toLowerCase() as Address,
      initiators: [],
      replicationDepth: 0,
      data: log.data,
    };

    return parsedLog;
  }

  getMatchedReplication({
    tx,
    replications,
    subscriptionAddress,
  }: MatchedReplicationParams): SessionReplication | undefined {
    const { tokenIn, tokenOut, amountIn, amountOut, network } = tx;
    const nativeToken = this.getSharedVars(network).nativeToken;
    const isInNative = tokenIn === nativeToken;
    const isOutNative = tokenOut === nativeToken;

    if (!isInNative && !isOutNative) return;

    if (isInNative) {
      return replications.find(
        repl =>
          repl.tokenAddress === tokenOut &&
          repl.subscriptionAddress === subscriptionAddress &&
          repl.buy >= parseInt(formatUnits(amountOut, repl.tokenDecimals)),
      );
    }

    if (isOutNative) {
      return replications.find(
        repl =>
          repl.tokenAddress === tokenIn &&
          repl.subscriptionAddress === subscriptionAddress &&
          repl.sell >= parseInt(formatUnits(amountIn, repl.tokenDecimals)),
      );
    }
  }

  async transfer({ tokenAddress, wallet, recipientAddress, txAmount }: TransferParams): Promise<void> {
    const { network } = wallet;
    const publicClient = this.clients.public[network];

    const account = this.getAccount(wallet);
    const { chain, rpcUrl } = this.getSharedVars(network);
    const walletClient = this.getWalletClient(chain, rpcUrl, account);

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      chain,
      functionName: 'transfer',
      args: [recipientAddress, txAmount],
      account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new BotError(`Tokens not sent ❌`, `🚫 Ошибка отправки токенов`, 400);
    }

    console.log('✅ Токены отправлены', receipt);
  }

  async transferNative({ wallet, recipientAddress, txAmount }: TransferNativeParams): Promise<void> {
    const { network } = wallet;
    const publicClient = this.clients.public[network];
    const currency = this.constants.chains[network].tokenSymbol;
    const account = this.getAccount(wallet);
    const { chain, rpcUrl } = this.getSharedVars(network);
    const walletClient = this.getWalletClient(chain, rpcUrl, account);

    const hash = await walletClient.sendTransaction({
      to: recipientAddress,
      value: txAmount,
      chain,
      account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new BotError(`${currency} not sent ❌`, `🚫 Ошибка отправки ${currency}`, 400);
    }

    console.log(`✅ ${currency} отправлены`, receipt);
  }

  async balanceOf({ tokenAddress, walletAddress, publicClient }: BalanceOfParams): Promise<bigint> {
    return publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
  }

  async approve({ tokenAddress, walletClient, tx, account }: ApproveParams): Promise<void> {
    const { network, routerAddress, amountIn } = tx;
    await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      chain: this.getSharedVars(network).chain,
      args: [routerAddress, amountIn],
      account,
    });
  }

  async allowance({ routerAddress, tokenAddress, walletAddress, network }: AllowanceParams): Promise<bigint> {
    const publicClient = this.clients.public[network];
    return publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress, routerAddress],
    });
  }

  async swap({ walletAddress, tx, account, walletClient, chatId }: SwapParams): Promise<SwapReturnType> {
    const { chain } = this.getSharedVars(tx.network);
    const swapArgs = await this.initSwapArgs({ tx, walletAddress });
    const { fn, args, value } = swapArgs;

    const hash = await walletClient.writeContract({
      address: tx.routerAddress,
      abi: routerAbi,
      functionName: fn,
      args,
      account,
      value,
      chain,
    });

    await this.redisService.setHashFeilds(
      `txContext:${hash}`,
      {
        initiators: JSON.stringify([...(tx.initiators ?? []), chatId]),
        replicationDepth: (tx.replicationDepth ?? 0) + 1,
      },
      300,
    );

    const publicClient = this.clients.public[tx.network];
    const receipt = await publicClient.getTransactionReceipt({ hash });
    const parsedLogs = parseEventLogs({
      abi: parsedPairAbi,
      eventName: 'Swap',
      logs: receipt.logs,
    });

    let amountIn: bigint = 0n;
    let amountOut: bigint = 0n;

    for (const log of parsedLogs) {
      if (!isSwapLog(log)) continue;
      if (log.args.amount0In > 0) {
        amountIn = log.args.amount0In;
        amountOut = log.args.amount1Out;
      } else {
        amountIn = log.args.amount1In;
        amountOut = log.args.amount0Out;
      }
    }
    return { amountIn, amountOut };
  }

  async getPair({ factoryAddress, nativeToken, tokenAddress, publicClient }: GetPairParams): Promise<PairAddresses> {
    const pairAddress = await publicClient.readContract({
      address: factoryAddress,
      abi: parsedFactoryAbi,
      functionName: 'getPair',
      args: [nativeToken, tokenAddress],
    });

    console.log('✅ Pair address:', pairAddress);

    if (pairAddress === '0x0000000000000000000000000000000000000000') {
      throw new BotError('Pair does not exist', 'Пара не существует', 400);
    }

    const [token0, token1] = await Promise.all([
      publicClient.readContract({
        address: pairAddress,
        abi: parsedPairAbi,
        functionName: 'token0',
      }),
      publicClient.readContract({
        address: pairAddress,
        abi: parsedPairAbi,
        functionName: 'token1',
      }),
    ]);

    console.log('✅ token0:', token0);
    console.log('✅ token1:', token1);

    return { pairAddress, token0, token1 };
  }

  getWalletClient(chain: Chain, rpcUrl: string, account: Account): WalletClient {
    return createWalletClient({
      chain,
      transport: http(rpcUrl),
      account,
    });
  }

  getAccount(wallet: Wallet): Account {
    return privateKeyToAccount(
      decryptPrivateKey({ encryptedPrivateKey: wallet.encryptedPrivateKey, encryptKey: this.constants.ENCRYPT_KEY }),
    );
  }

  notifyUser({ chatId, text }: { chatId: number; text: string }): void {
    this.eventEmitter.emit('notifyUser', { chatId, text });
  }

  handleError(error: unknown, errMsg: string): void {
    this.logger.error(errMsg, error);

    if (error instanceof BotError) {
      const text = error.userMessage;
      if (error.chatId) this.notifyUser({ chatId: error.chatId, text });
    }
  }
}
