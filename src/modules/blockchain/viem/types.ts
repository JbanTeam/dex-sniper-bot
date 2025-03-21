import { Address, PublicClient, WalletClient } from 'viem';

import { Network, SessionUserToken } from '@src/types/types';

type ViemClientsType = {
  public: {
    [key in Network]: PublicClient;
  };
  wallet: {
    [key in Network]: WalletClient;
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

export { ViemClientsType, DeployTestContractParams, TestBalanceParams, SendTestTokenParams, Transaction };
