import { Address, PublicClient } from 'viem';

import { Network, SessionUserToken } from '@src/types/types';
import { Wallet } from '@modules/wallet/wallet.entity';

type ViemClientsType = {
  public: {
    [key in Network]: PublicClient;
  };
  publicWebsocket: {
    [key in Network]: PublicClient;
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

type GetBalanceParams = {
  chatId: number;
  address: Address;
  network: Network;
};

type GetTokenBalanceParams = {
  tokenAddress: Address;
  walletAddress: Address;
  network: Network;
};

type TokenBalanceReturnType = { symbol: string; amount: string; decimals: number };

type SendTokensParams = {
  wallet: Wallet;
  tokenAddress: Address;
  amount: string;
  recipientAddress: Address;
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

type Transaction = {
  hash: Address;
  from: Address;
  to: Address;
  contractAddress: Address;
  value: string;
  data: string;
  network: Network;
};

type BalanceInfo = {
  address: Address;
  network: Network;
  nativeBalance: {
    symbol: string;
    amount: string;
  };
  tokenBalances: Array<{
    symbol: string;
    amount: string;
    decimals: number;
  }>;
};

export {
  ViemClientsType,
  DeployTestContractParams,
  DeployContractParams,
  GetBalanceParams,
  GetTokenBalanceParams,
  TokenBalanceReturnType,
  TestBalanceParams,
  SendTokensParams,
  SendTransactionParams,
  SendTestTokenParams,
  Transaction,
  BalanceInfo,
};
