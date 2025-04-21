import { PublicClient } from 'viem';

import { Wallet } from '@modules/wallet/wallet.entity';
import { Address, SessionUserToken, ViemNetwork } from '@src/types/types';

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
};

type SendTransactionParams = {
  tokenAddress: Address;
  wallet: Wallet;
  recipientAddress: Address;
  amount: string;
  decimals: number;
};

type TestBalanceParams = {
  contractAddress: Address;
  testAccount: Address;
  decimals: number;
  name: string;
};

type SendTestTokenParams = {
  contractAddress: Address;
  testAccount: Address;
  walletAddress: Address;
  decimals: number;
};

type CachedContractsType = {
  wbnb: `0x${string}`;
  factory: `0x${string}`;
  router: `0x${string}`;
};

type ErcSwapFnType = 'swapExactETHForTokens' | 'swapExactTokensForETH' | 'swapExactTokensForTokens';

type SwapLog = {
  eventName: 'Swap';
  args: {
    sender: `0x${string}`;
    amountIn: bigint;
    amountOut: bigint;
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
  };
  address: `0x${string}`;
  topics: `0x${string}`[];
  data: `0x${string}`;
  blockHash: `0x${string}`;
  blockNumber: bigint;
  blockTimestamp: string;
  transactionHash: `0x${string}`;
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
  SendTestTokenParams,
  CachedContractsType,
  ErcSwapFnType,
  SwapLog,
};
