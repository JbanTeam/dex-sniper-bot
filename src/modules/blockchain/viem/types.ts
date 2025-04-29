import { Account, PublicClient, WalletClient } from 'viem';

import { Transaction } from '../types';
import { Wallet } from '@modules/wallet/wallet.entity';
import { Address, Network, SessionReplication, SessionUserToken, ViemNetwork } from '@src/types/types';

type ViemClientsType = {
  public: {
    [key in ViemNetwork]: PublicClient;
  };
  publicWebsocket: {
    [key in ViemNetwork]: PublicClient;
  };
};

type DeployTestContractParams = {
  token: SessionUserToken;
  count?: string;
  walletAddress: Address;
};

type DeployContractParams = {
  name: string;
  symbol: string;
  decimals: number;
  count: string;
  network: Network;
};

type SendTransactionParams = {
  tokenAddress: Address;
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
  walletAddress: Address;
  tx: Transaction;
  account: Account;
  walletClient: WalletClient;
};

type CachedContractsType = {
  nativeToken: Address;
  factoryAddress: Address;
  routerAddress: Address;
};

type ErcSwapFnType = 'swapExactETHForTokens' | 'swapExactTokensForETH' | 'swapExactTokensForTokens';

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
  DeployTestContractParams,
  DeployContractParams,
  TestBalanceParams,
  SendTransactionParams,
  BalanceAllowanceParams,
  AllowanceParams,
  BalanceOfParams,
  ApproveParams,
  SwapParams,
  SendTestTokenParams,
  CachedContractsType,
  ErcSwapFnType,
  SwapLog,
};
