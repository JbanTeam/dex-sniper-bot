import { Account, Chain, PublicClient, WalletClient } from 'viem';

import { PairAddresses, Transaction } from '../types';
import { Wallet } from '@modules/wallet/wallet.entity';
import { Address, Network, SessionReplication, SessionUserToken, ViemNetwork } from '@src/types/types';
import { Subscription } from '@modules/subscription/subscription.entity';

type ViemClientsType = {
  public: {
    [key in ViemNetwork]: PublicClient;
  };
  publicWebsocket: {
    [key in ViemNetwork]: PublicClient;
  };
};

type CreateTokenParams = {
  name: string;
  symbol: string;
  decimals: number;
  count: string;
  network: Network;
};

type CreateTokenReturnType = {
  tokenAddress: Address;
  pairAddresses: PairAddresses;
};

type TransferParams = {
  tokenAddress: Address;
  wallet: Wallet;
  recipientAddress: Address;
  txAmount: bigint;
};

type TransferNativeParams = {
  wallet: Wallet;
  recipientAddress: Address;
  txAmount: bigint;
};

type TestBalanceParams = {
  tokenAddress: Address;
  walletAddress: Address;
  decimals: number;
  name: string;
};

type SendTestTokenParams = {
  tokenAddress: Address;
  sender: Address;
  walletAddress: Address;
  decimals: number;
};

type BalanceAllowanceParams = {
  replication: SessionReplication;
  account: Account;
  tx: Transaction;
  walletClient: WalletClient;
};

type AllowanceParams = {
  routerAddress: Address;
  tokenAddress: Address;
  walletAddress: Address;
  network: Network;
};

type BalanceAllowanceReturnType = {
  currencyIn: string;
  currencyOut: string;
  inDecimals: number;
  outDecimals: number;
};

type BalanceOfParams = {
  tokenAddress: Address;
  walletAddress: Address;
  publicClient: PublicClient;
};

type ApproveParams = {
  tokenAddress: Address;
  walletClient: WalletClient;
  tx: Transaction;
  account: Account;
};

type SwapParams = {
  chatId: number;
  walletAddress: Address;
  tx: Transaction;
  account: Account;
  walletClient: WalletClient;
};

type SwapReturnType = { amountOut: bigint; amountIn: bigint };

type CachedContractsType = {
  nativeToken: Address;
  factoryAddress: Address;
  routerAddress: Address;
};

type ReplicateTransactionParams = {
  subscription: Subscription;
  tx: Transaction;
};

type InitSwapArgsParams = {
  tx: Transaction;
  walletAddress: Address;
  slippageBps?: number;
};

type InitSwapArgsReturnType = { fn: ErcSwapFnType; args: any[]; value: bigint | undefined };

type SharedVarsReturnType = { chain: Chain; rpcUrl: string; nativeToken: Address; routerAddress: Address };

type MatchedReplicationParams = {
  tx: Transaction;
  replications: SessionReplication[];
  subscriptionAddress: Address;
};

type GetPairParams = {
  tokenAddress: Address;
  nativeToken: Address;
  factoryAddress: Address;
  publicClient: PublicClient;
};

type DeployTokenParams = {
  exchangeAddress: Address;
  name: string;
  symbol: string;
  decimals: number;
  count: string;
};

type AnvilSwapParams = {
  recipientAddress: Address;
  amountIn: bigint;
  deadline: bigint;
  path: Address[];
  fn: ErcSwapFnType;
  minAmountOut: bigint;
};

type AddLiquidityParams = { exchangeAddress: Address; tokenAddress: Address; network: Network; decimals: number };

type CreateTestTokenParams = {
  token: SessionUserToken;
  count?: string;
  walletAddress: Address;
};

type CreateTestTokenReturnType = {
  token: SessionUserToken;
  pairAddresses: PairAddresses;
};

type ErcSwapFnType = 'swapExactETHForTokens' | 'swapExactTokensForETH' | 'swapExactTokensForTokens';

type UnwatchCallback = { [key in ViemNetwork]: () => void };

type SwapLog = {
  eventName: 'Swap';
  args: {
    sender: Address;
    to: Address;
    amount0In: bigint;
    amount1In: bigint;
    amount0Out: bigint;
    amount1Out: bigint;
  };
  address: Address;
  topics: Address[];
  data: Address;
  blockHash: Address;
  blockNumber: bigint;
  blockTimestamp: string;
  transactionHash: Address;
  transactionIndex: number;
  logIndex: number;
  removed: boolean;
};

export {
  ViemClientsType,
  CreateTokenParams,
  CreateTokenReturnType,
  TestBalanceParams,
  TransferParams,
  TransferNativeParams,
  BalanceAllowanceParams,
  BalanceAllowanceReturnType,
  AllowanceParams,
  BalanceOfParams,
  ApproveParams,
  SwapParams,
  SwapReturnType,
  SendTestTokenParams,
  CachedContractsType,
  ReplicateTransactionParams,
  InitSwapArgsParams,
  InitSwapArgsReturnType,
  SharedVarsReturnType,
  MatchedReplicationParams,
  GetPairParams,
  DeployTokenParams,
  AnvilSwapParams,
  AddLiquidityParams,
  CreateTestTokenParams,
  CreateTestTokenReturnType,
  ErcSwapFnType,
  UnwatchCallback,
  SwapLog,
};
